'use client'
import { forwardRef } from 'react'
import {
  MDXEditor, type MDXEditorMethods, type MDXEditorProps,
  headingsPlugin, listsPlugin, quotePlugin, thematicBreakPlugin,
  linkPlugin, linkDialogPlugin, imagePlugin, tablePlugin,
  codeBlockPlugin, codeMirrorPlugin, markdownShortcutPlugin, diffSourcePlugin,
  toolbarPlugin, DiffSourceToggleWrapper, UndoRedo, Separator,
  BoldItalicUnderlineToggles, CodeToggle, BlockTypeSelect, ListsToggle,
  CreateLink, InsertImage, InsertTable, InsertThematicBreak, InsertCodeBlock,
} from '@mdxeditor/editor'
import '@mdxeditor/editor/style.css'

function Toolbar() {
  return (
    <DiffSourceToggleWrapper>
      <UndoRedo />
      <Separator />
      <BoldItalicUnderlineToggles />
      <CodeToggle />
      <Separator />
      <BlockTypeSelect />
      <Separator />
      <ListsToggle />
      <Separator />
      <CreateLink />
      <InsertImage />
      <InsertTable />
      <InsertThematicBreak />
      <InsertCodeBlock />
    </DiffSourceToggleWrapper>
  )
}

const InitializedMDXEditor = forwardRef<MDXEditorMethods, MDXEditorProps>((props, ref) => (
  <MDXEditor
    ref={ref}
    contentEditableClassName="prose max-w-none"
    plugins={[
      headingsPlugin(),
      listsPlugin(),
      quotePlugin(),
      thematicBreakPlugin(),
      linkPlugin(),
      linkDialogPlugin(),
      imagePlugin(),
      tablePlugin(),
      codeBlockPlugin({ defaultCodeBlockLanguage: 'txt' }),
      codeMirrorPlugin({ codeBlockLanguages: { txt: 'Plain Text', js: 'JavaScript', ts: 'TypeScript', css: 'CSS', html: 'HTML', json: 'JSON' } }),
      markdownShortcutPlugin(),
      diffSourcePlugin({ viewMode: 'rich-text' }),
      toolbarPlugin({ toolbarContents: () => <Toolbar /> }),
    ]}
    {...props}
  />
))
InitializedMDXEditor.displayName = 'InitializedMDXEditor'

export default InitializedMDXEditor
