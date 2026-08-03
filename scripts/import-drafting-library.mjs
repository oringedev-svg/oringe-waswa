/*
 * One-time / repeatable importer for the supplied drafting library.
 * Run after migration 045 with NEXT_PUBLIC_SUPABASE_URL and
 * SUPABASE_SERVICE_ROLE_KEY set. It uploads only editable .docx/.doc files
 * in the curated numbered folders and never imports 99_REFERENCE_LIBRARY as
 * a generative template.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const root = path.resolve('Legal_Drafting_Template_Library (1)/FINAL_PACKAGE/LEGAL_TEMPLATE_LIBRARY');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before importing templates.');
const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

const contexts = {
  '01_PLEADINGS_AND_COURT_PROCESS': { category: 'Pleadings & Court Process', areas: ['civil_litigation','constitutional'], artifact: 'Court Filing', events: ['Draft Pleading/Petition','Court Filing'] },
  '02_APPLICATIONS_AND_MOTIONS': { category: 'Applications & Motions', areas: ['civil_litigation','constitutional','family_law'], artifact: 'Document', events: ['Draft Pleading/Petition','Draft Affidavit','Court Filing'] },
  '04_PROBATE_AND_SUCCESSION_FORMS': { category: 'Probate & Succession', areas: ['probate_succession','family_law'], artifact: 'Petition', events: ['Draft Pleading/Petition','Court Filing'] },
  '05_CONVEYANCING_AND_PROPERTY_INSTRUMENTS': { category: 'Property Instruments', areas: ['property','property_law'], artifact: 'Contract/Agreement', events: ['Draft Agreement/Contract','Closing'] },
  '06_COMMERCIAL_AND_CORPORATE_INSTRUMENTS': { category: 'Commercial & Corporate', areas: ['corporate','corporate_law'], artifact: 'Contract/Agreement', events: ['Draft Agreement/Contract'] },
  '07_CRIMINAL_PROCESS_DOCUMENTS': { category: 'Criminal Process', areas: ['criminal_defense'], artifact: 'Document', events: ['Draft Pleading/Petition','Court Filing'] },
  '08_CORRESPONDENCE_OPINIONS_AND_MEMOS': { category: 'Correspondence, Opinions & Memos', areas: [], artifact: 'Document', events: ['Correspondence','Legal Opinion'] },
  '09_TRIAL_ADVOCACY_DOCUMENTS': { category: 'Trial Advocacy', areas: ['civil_litigation','criminal_defense'], artifact: 'Document', events: ['Hearing Preparation','Skeleton Argument Preparation'] },
  '10_COSTS_AND_BILLING': { category: 'Costs & Billing', areas: [], artifact: 'Bill of Costs', events: ['Bill of Costs Taxation'] },
  '11_FIRM_AND_PRACTICE_MANAGEMENT': { category: 'Firm Management', areas: [], artifact: null, events: [], scope: 'INTERNAL_ONLY' },
};

async function files(dir) { const entries = await fs.readdir(dir, { withFileTypes: true }); const out = []; for (const e of entries) { const full = path.join(dir, e.name); if (e.isDirectory()) out.push(...await files(full)); else if (/\.(docx|doc)$/i.test(e.name)) out.push(full); } return out; }
const slug = (v) => v.toLowerCase().replace(/\.(docx|doc)$/i, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

for (const [folder, context] of Object.entries(contexts)) {
  const folderPath = path.join(root, folder);
  for (const fullPath of await files(folderPath)) {
    const relative = path.relative(root, fullPath).split(path.sep).join('/');
    const objectPath = `templates/drafting-library/${relative}`;
    const bytes = await fs.readFile(fullPath);
    const contentType = fullPath.toLowerCase().endsWith('.docx') ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'application/msword';
    const { error: uploadError } = await supabase.storage.from('legal-docs').upload(objectPath, bytes, { contentType, upsert: true });
    if (uploadError) throw uploadError;
    const record = { name: path.basename(fullPath).replace(/\.(docx|doc)$/i, '').replaceAll('_', ' '), slug: slug(relative), category: context.category, source_relative_path: relative, storage_path: objectPath, file_extension: path.extname(fullPath).slice(1).toLowerCase(), practice_area_keys: context.areas, artifact_type_name: context.artifact, trigger_events: context.events, usage_scope: context.scope || 'MATTER', requires_review: context.scope !== 'INTERNAL_ONLY', status: 'ACTIVE', guidance: 'Create a matter-owned working copy; verify facts, current law, court requirements, parties and dates before filing.' };
    const { error } = await supabase.from('document_templates').upsert(record, { onConflict: 'source_relative_path' });
    if (error) throw error;
    console.log(`Imported ${relative}`);
  }
}
