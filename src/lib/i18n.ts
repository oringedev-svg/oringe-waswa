// ============================================================
// ORINGE WASWA, Complete Translation Dictionary
// Supports: English, Swahili, French, Arabic, Chinese, Portuguese, Spanish, Hindi
// ============================================================

export type Locale = 'en' | 'sw' | 'fr' | 'ar' | 'zh' | 'pt' | 'es' | 'hi'

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'sw', label: 'Kiswahili', flag: '🇰🇪' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'ar', label: 'العربية', flag: '🇸🇦', rtl: true },
  { code: 'zh', label: '中文', flag: '🇨🇳' },
  { code: 'pt', label: 'Português', flag: '🇧🇷' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'hi', label: 'हिन्दी', flag: '🇮🇳' },
] as const

export const translations = {
  // ---- NAVIGATION ----
  nav: {
    home:           { en: 'Home', sw: 'Nyumbani', fr: 'Accueil', ar: 'الرئيسية', zh: '首页', pt: 'Início', es: 'Inicio', hi: 'होम' },
    services:       { en: 'Services', sw: 'Huduma', fr: 'Services', ar: 'الخدمات', zh: '服务', pt: 'Serviços', es: 'Servicios', hi: 'सेवाएं' },
    team:           { en: 'Our Team', sw: 'Timu Yetu', fr: 'Notre Équipe', ar: 'فريقنا', zh: '我们的团队', pt: 'Nossa Equipe', es: 'Nuestro Equipo', hi: 'हमारी टीम' },
    blog:           { en: 'Blog', sw: 'Blogu', fr: 'Blog', ar: 'المدونة', zh: '博客', pt: 'Blog', es: 'Blog', hi: 'ब्लॉग' },
    insights:       { en: 'Insights', sw: 'Maarifa', fr: 'Perspectives', ar: 'رؤى', zh: '洞察', pt: 'Perspectivas', es: 'Perspectivas', hi: 'अंतर्दृष्टि' },
    gallery:        { en: 'Gallery', sw: 'Picha', fr: 'Galerie', ar: 'معرض', zh: '图库', pt: 'Galeria', es: 'Galería', hi: 'गैलरी' },
    contact:        { en: 'Contact', sw: 'Wasiliana', fr: 'Contact', ar: 'اتصل', zh: '联系', pt: 'Contato', es: 'Contacto', hi: 'संपर्क' },
    bookAppt:       { en: 'Book Appointment', sw: 'Hifadhi Miadi', fr: 'Prendre RDV', ar: 'احجز موعد', zh: '预约咨询', pt: 'Agendar', es: 'Agendar Cita', hi: 'अपॉइंटमेंट बुक करें' },
    trackSub:       { en: 'Track Submission', sw: 'Fuatilia Maombi', fr: 'Suivi Dossier', ar: 'تتبع الطلب', zh: '跟踪申请', pt: 'Rastrear', es: 'Rastrear', hi: 'आवेदन ट्रैक करें' },
    volunteer:      { en: 'Volunteer', sw: 'Kujitolea', fr: 'Bénévolat', ar: 'تطوع', zh: '志愿者', pt: 'Voluntário', es: 'Voluntario', hi: 'स्वयंसेवक' },
    admin:          { en: 'Admin Portal', sw: 'Lango la Admin', fr: 'Portail Admin', ar: 'بوابة الإدارة', zh: '管理门户', pt: 'Portal Admin', es: 'Portal Admin', hi: 'एडमिन पोर्टल' },
  },

  // ---- HERO ----
  hero: {
    tagline:        { en: 'Advocates and Solicitors', sw: 'Mawakili na Washauri wa Kisheria', fr: 'Avocats & Juristes', ar: 'محامون ومستشارون قانونيون', zh: '律师事务所', pt: 'Advogados e Consultores', es: 'Abogados y Asesores', hi: 'अधिवक्ता और सॉलिसिटर' },
    headline1:      { en: 'Justice.', sw: 'Haki.', fr: 'Justice.', ar: 'العدالة.', zh: '正义。', pt: 'Justiça.', es: 'Justicia.', hi: 'न्याय।' },
    headline2:      { en: 'Integrity.', sw: 'Uaminifu.', fr: 'Intégrité.', ar: 'النزاهة.', zh: '诚信。', pt: 'Integridade.', es: 'Integridad.', hi: 'ईमानदारी।' },
    headline3:      { en: 'Excellence.', sw: 'Ubora.', fr: 'Excellence.', ar: 'التميز.', zh: '卓越。', pt: 'Excelência.', es: 'Excelencia.', hi: 'उत्कृष्टता।' },
    subheading:     { en: "Kenya's trusted legal counsel. We deliver comprehensive legal services with precision, integrity, and an unwavering commitment to your rights.", sw: 'Washauri wa kisheria wanaoaminika nchini Kenya. Tunafanya huduma za kisheria kwa usahihi, uaminifu, na kujitolea kwa haki zako.', fr: 'Conseil juridique de confiance au Kenya. Nous offrons des services juridiques complets avec précision et intégrité.', ar: 'المستشار القانوني الموثوق في كينيا. نقدم خدمات قانونية شاملة بدقة ونزاهة.', zh: '肯尼亚值得信赖的法律顾问。我们以精准、诚信和对您权利的坚定承诺提供全面法律服务。', pt: 'Consultoria jurídica confiável do Quênia. Prestamos serviços jurídicos abrangentes com precisão e integridade.', es: 'Asesoría legal de confianza en Kenia. Brindamos servicios legales integrales con precisión e integridad.', hi: 'केन्या का विश्वसनीय कानूनी सलाहकार। हम सटीकता, ईमानदारी और आपके अधिकारों के प्रति अटूट प्रतिबद्धता के साथ व्यापक कानूनी सेवाएं प्रदान करते हैं।' },
    cta1:           { en: 'Book a Consultation', sw: 'Hifadhi Ushauri', fr: 'Prendre Rendez-vous', ar: 'احجز استشارة', zh: '预约咨询', pt: 'Agendar Consulta', es: 'Agendar Consulta', hi: 'परामर्श बुक करें' },
    cta2:           { en: 'Our Practice Areas', sw: 'Maeneo Yetu ya Sheria', fr: 'Nos Domaines', ar: 'مجالاتنا القانونية', zh: '我们的业务领域', pt: 'Nossas Áreas', es: 'Nuestras Áreas', hi: 'हमारे अभ्यास क्षेत्र' },
    established:    { en: 'Nairobi Bar', sw: 'Chama cha Mawakili Nairobi', fr: 'Barreau de Nairobi', ar: 'نقابة محامي نيروبي', zh: '内罗毕律师协会', pt: 'Ordem de Nairobi', es: 'Colegio de Nairobi', hi: 'नैरोबी बार' },
    confidential:   { en: 'Attorney-Client Privilege', sw: 'Usiri wa Mwanasheria-Mteja', fr: 'Secret Professionnel', ar: 'امتياز المحامي-الموكل', zh: '律师-委托人特权', pt: 'Sigilo Profissional', es: 'Privilegio Abogado-Cliente', hi: 'वकील-मुवक्किल विशेषाधिकार' },
    coverage:       { en: 'East Africa', sw: 'Afrika Mashariki', fr: "Afrique de l'Est", ar: 'أفريقيا الشرقية', zh: '东非', pt: 'África Oriental', es: 'África Oriental', hi: 'पूर्वी अफ्रीका' },
  },

  // ---- SERVICES ----
  services: {
    sectionLabel:   { en: 'What We Do', sw: 'Tunachofanya', fr: 'Ce Que Nous Faisons', ar: 'ما نقدمه', zh: '我们的业务', pt: 'O Que Fazemos', es: 'Lo Que Hacemos', hi: 'हम क्या करते हैं' },
    sectionTitle:   { en: 'Practice Areas', sw: 'Maeneo ya Utaalamu', fr: 'Domaines de Pratique', ar: 'مجالات الممارسة', zh: '业务领域', pt: 'Áreas de Prática', es: 'Áreas de Práctica', hi: 'अभ्यास क्षेत्र' },
    viewAll:        { en: 'View All Services', sw: 'Ona Huduma Zote', fr: 'Voir Tous les Services', ar: 'عرض كل الخدمات', zh: '查看所有服务', pt: 'Ver Todos os Serviços', es: 'Ver Todos los Servicios', hi: 'सभी सेवाएं देखें' },
    civil:          { en: 'Civil Litigation', sw: 'Mashauri ya Madai', fr: 'Contentieux Civil', ar: 'التقاضي المدني', zh: '民事诉讼', pt: 'Litígio Civil', es: 'Litigios Civiles', hi: 'दीवानी मुकदमेबाजी' },
    criminal:       { en: 'Criminal Defense', sw: 'Utetezi wa Jinai', fr: 'Défense Pénale', ar: 'الدفاع الجنائي', zh: '刑事辩护', pt: 'Defesa Criminal', es: 'Defensa Penal', hi: 'आपराधिक बचाव' },
    family:         { en: 'Family Law', sw: 'Sheria ya Familia', fr: 'Droit de la Famille', ar: 'قانون الأسرة', zh: '家庭法', pt: 'Direito de Família', es: 'Derecho de Familia', hi: 'पारिवारिक कानून' },
    corporate:      { en: 'Corporate Law', sw: 'Sheria ya Kampuni', fr: 'Droit des Affaires', ar: 'قانون الشركات', zh: '公司法', pt: 'Direito Empresarial', es: 'Derecho Corporativo', hi: 'कॉर्पोरेट कानून' },
    property:       { en: 'Property Law', sw: 'Sheria ya Mali', fr: 'Droit Immobilier', ar: 'قانون الملكية', zh: '财产法', pt: 'Direito Imobiliário', es: 'Derecho Inmobiliario', hi: 'संपत्ति कानून' },
    immigration:    { en: 'Immigration', sw: 'Uhamiaji', fr: 'Immigration', ar: 'الهجرة', zh: '移民', pt: 'Imigração', es: 'Inmigración', hi: 'आव्रजन' },
    employment:     { en: 'Employment Law', sw: 'Sheria ya Ajira', fr: "Droit du Travail", ar: 'قانون العمل', zh: '劳动法', pt: 'Direito do Trabalho', es: 'Derecho Laboral', hi: 'रोजगार कानून' },
    ip:             { en: 'Intellectual Property', sw: 'Haki Miliki', fr: 'Propriété Intellectuelle', ar: 'الملكية الفكرية', zh: '知识产权', pt: 'Propriedade Intelectual', es: 'Propiedad Intelectual', hi: 'बौद्धिक संपदा' },
    constitutional: { en: 'Constitutional Law', sw: 'Sheria ya Katiba', fr: 'Droit Constitutionnel', ar: 'القانون الدستوري', zh: '宪法法律', pt: 'Direito Constitucional', es: 'Derecho Constitucional', hi: 'संवैधानिक कानून' },
    adr:            { en: 'Alternative Dispute', sw: 'Usuluhishi Mbadala', fr: 'Résolution Alternative', ar: 'التسوية البديلة', zh: '替代性争议解决', pt: 'Resolução Alternativa', es: 'Resolución Alternativa', hi: 'वैकल्पिक विवाद' },
  },

  // ---- COMMON FORM LABELS ----
  form: {
    fullName:       { en: 'Full Name', sw: 'Jina Kamili', fr: 'Nom Complet', ar: 'الاسم الكامل', zh: '全名', pt: 'Nome Completo', es: 'Nombre Completo', hi: 'पूरा नाम' },
    email:          { en: 'Email Address', sw: 'Barua Pepe', fr: 'Adresse Email', ar: 'البريد الإلكتروني', zh: '电子邮件', pt: 'Email', es: 'Correo Electrónico', hi: 'ईमेल पता' },
    phone:          { en: 'Phone Number', sw: 'Nambari ya Simu', fr: 'Numéro de Téléphone', ar: 'رقم الهاتف', zh: '电话号码', pt: 'Telefone', es: 'Número de Teléfono', hi: 'फोन नंबर' },
    message:        { en: 'Message', sw: 'Ujumbe', fr: 'Message', ar: 'الرسالة', zh: '留言', pt: 'Mensagem', es: 'Mensaje', hi: 'संदेश' },
    subject:        { en: 'Subject', sw: 'Mada', fr: 'Sujet', ar: 'الموضوع', zh: '主题', pt: 'Assunto', es: 'Asunto', hi: 'विषय' },
    submit:         { en: 'Submit', sw: 'Wasilisha', fr: 'Soumettre', ar: 'إرسال', zh: '提交', pt: 'Enviar', es: 'Enviar', hi: 'सबमिट करें' },
    save:           { en: 'Save', sw: 'Hifadhi', fr: 'Enregistrer', ar: 'حفظ', zh: '保存', pt: 'Salvar', es: 'Guardar', hi: 'सहेजें' },
    cancel:         { en: 'Cancel', sw: 'Ghairi', fr: 'Annuler', ar: 'إلغاء', zh: '取消', pt: 'Cancelar', es: 'Cancelar', hi: 'रद्द करें' },
    delete:         { en: 'Delete', sw: 'Futa', fr: 'Supprimer', ar: 'حذف', zh: '删除', pt: 'Excluir', es: 'Eliminar', hi: 'हटाएं' },
    edit:           { en: 'Edit', sw: 'Hariri', fr: 'Modifier', ar: 'تعديل', zh: '编辑', pt: 'Editar', es: 'Editar', hi: 'संपादित करें' },
    add:            { en: 'Add', sw: 'Ongeza', fr: 'Ajouter', ar: 'إضافة', zh: '添加', pt: 'Adicionar', es: 'Agregar', hi: 'जोड़ें' },
    loading:        { en: 'Loading…', sw: 'Inapakia…', fr: 'Chargement…', ar: 'جاري التحميل…', zh: '加载中…', pt: 'Carregando…', es: 'Cargando…', hi: 'लोड हो रहा है…' },
    required:       { en: 'Required', sw: 'Inahitajika', fr: 'Requis', ar: 'مطلوب', zh: '必填', pt: 'Obrigatório', es: 'Requerido', hi: 'आवश्यक' },
    optional:       { en: 'Optional', sw: 'Hiari', fr: 'Optionnel', ar: 'اختياري', zh: '可选', pt: 'Opcional', es: 'Opcional', hi: 'वैकल्पिक' },
    search:         { en: 'Search', sw: 'Tafuta', fr: 'Rechercher', ar: 'بحث', zh: '搜索', pt: 'Pesquisar', es: 'Buscar', hi: 'खोजें' },
    filter:         { en: 'Filter', sw: 'Chuja', fr: 'Filtrer', ar: 'تصفية', zh: '筛选', pt: 'Filtrar', es: 'Filtrar', hi: 'फ़िल्टर' },
    noResults:      { en: 'No results found', sw: 'Hakuna matokeo', fr: 'Aucun résultat', ar: 'لا نتائج', zh: '未找到结果', pt: 'Nenhum resultado', es: 'Sin resultados', hi: 'कोई परिणाम नहीं' },
    confirm:        { en: 'Confirm', sw: 'Thibitisha', fr: 'Confirmer', ar: 'تأكيد', zh: '确认', pt: 'Confirmar', es: 'Confirmar', hi: 'पुष्टि करें' },
    back:           { en: 'Back', sw: 'Rudi', fr: 'Retour', ar: 'رجوع', zh: '返回', pt: 'Voltar', es: 'Volver', hi: 'वापस' },
    next:           { en: 'Next', sw: 'Ifuatayo', fr: 'Suivant', ar: 'التالي', zh: '下一步', pt: 'Próximo', es: 'Siguiente', hi: 'अगला' },
    previous:       { en: 'Previous', sw: 'Iliyopita', fr: 'Précédent', ar: 'السابق', zh: '上一步', pt: 'Anterior', es: 'Anterior', hi: 'पिछला' },
  },

  // ---- APPOINTMENTS ----
  appointments: {
    title:          { en: 'Book a Consultation', sw: 'Hifadhi Ushauri', fr: 'Réserver une Consultation', ar: 'احجز استشارة', zh: '预约咨询', pt: 'Agendar Consulta', es: 'Reservar Consulta', hi: 'परामर्श बुक करें' },
    matterType:     { en: 'Matter Type', sw: 'Aina ya Suala', fr: 'Type d\'Affaire', ar: 'نوع القضية', zh: '案件类型', pt: 'Tipo de Assunto', es: 'Tipo de Asunto', hi: 'मामले का प्रकार' },
    description:    { en: 'Brief Description', sw: 'Maelezo Mafupi', fr: 'Description Brève', ar: 'وصف موجز', zh: '简要描述', pt: 'Breve Descrição', es: 'Breve Descripción', hi: 'संक्षिप्त विवरण' },
    preferredDate:  { en: 'Preferred Date', sw: 'Tarehe Unayopendelea', fr: 'Date Préférée', ar: 'التاريخ المفضل', zh: '首选日期', pt: 'Data Preferida', es: 'Fecha Preferida', hi: 'पसंदीदा तारीख' },
    preferredTime:  { en: 'Preferred Time', sw: 'Wakati Unaopendelea', fr: 'Heure Préférée', ar: 'الوقت المفضل', zh: '首选时间', pt: 'Horário Preferido', es: 'Hora Preferida', hi: 'पसंदीदा समय' },
    virtual:        { en: 'I prefer a virtual consultation', sw: 'Ninapendelea ushauri wa mtandaoni', fr: 'Je préfère une consultation virtuelle', ar: 'أفضل الاستشارة الافتراضية', zh: '我希望虚拟咨询', pt: 'Prefiro consulta virtual', es: 'Prefiero consulta virtual', hi: 'मैं वर्चुअल परामर्श पसंद करता हूं' },
    confirmed:      { en: 'Appointment Confirmed!', sw: 'Miadi Imethibitishwa!', fr: 'Rendez-vous Confirmé!', ar: 'تم تأكيد الموعد!', zh: '预约已确认！', pt: 'Consulta Confirmada!', es: '¡Cita Confirmada!', hi: 'अपॉइंटमेंट की पुष्टि हो गई!' },
  },

  // ---- TRACKING ----
  tracking: {
    title:          { en: 'Track Your Submission', sw: 'Fuatilia Maombi Yako', fr: 'Suivre Votre Dossier', ar: 'تتبع طلبك', zh: '跟踪您的申请', pt: 'Rastrear Seu Pedido', es: 'Rastrear Su Solicitud', hi: 'अपना आवेदन ट्रैक करें' },
    trackingCode:   { en: 'Tracking Code', sw: 'Nambari ya Ufuatiliaji', fr: 'Code de Suivi', ar: 'رمز التتبع', zh: '追踪码', pt: 'Código de Rastreamento', es: 'Código de Seguimiento', hi: 'ट्रैकिंग कोड' },
    enterCode:      { en: 'Enter your tracking code', sw: 'Weka nambari yako ya ufuatiliaji', fr: 'Entrez votre code de suivi', ar: 'أدخل رمز التتبع', zh: '输入您的追踪码', pt: 'Digite seu código de rastreamento', es: 'Ingrese su código de seguimiento', hi: 'अपना ट्रैकिंग कोड दर्ज करें' },
    trackBtn:       { en: 'Track Submission', sw: 'Fuatilia Maombi', fr: 'Suivre le Dossier', ar: 'تتبع الطلب', zh: '追踪申请', pt: 'Rastrear Pedido', es: 'Rastrear Solicitud', hi: 'आवेदन ट्रैक करें' },
    notFound:       { en: 'Submission not found. Please check your tracking code.', sw: 'Maombi hayakupatikana. Tafadhali angalia nambari yako.', fr: 'Dossier introuvable. Vérifiez votre code.', ar: 'لم يتم العثور على الطلب.', zh: '未找到申请，请检查您的追踪码。', pt: 'Pedido não encontrado.', es: 'Solicitud no encontrada.', hi: 'आवेदन नहीं मिला। कृपया अपना ट्रैकिंग कोड जांचें।' },
    timeline:       { en: 'Status Timeline', sw: 'Mfululizo wa Hali', fr: 'Chronologie du Statut', ar: 'الجدول الزمني', zh: '状态时间线', pt: 'Linha do Tempo', es: 'Línea de Tiempo', hi: 'स्थिति समयरेखा' },
  },

  // ---- CONTACT & SUBMISSIONS ----
  contact: {
    title:          { en: 'Contact and Apply', sw: 'Wasiliana & Omba', fr: 'Contact & Postuler', ar: 'اتصل وتقدم', zh: '联系与申请', pt: 'Contato & Candidatura', es: 'Contacto & Solicitar', hi: 'संपर्क और आवेदन' },
    contactUs:      { en: 'Contact Us', sw: 'Wasiliana Nasi', fr: 'Nous Contacter', ar: 'اتصل بنا', zh: '联系我们', pt: 'Fale Conosco', es: 'Contáctenos', hi: 'हमसे संपर्क करें' },
    jobApplication: { en: 'Job Application', sw: 'Maombi ya Kazi', fr: 'Candidature', ar: 'طلب وظيفة', zh: '求职申请', pt: 'Candidatura', es: 'Solicitud de Empleo', hi: 'नौकरी आवेदन' },
    volunteer:      { en: 'Volunteer', sw: 'Kujitolea', fr: 'Bénévolat', ar: 'تطوع', zh: '志愿者', pt: 'Voluntário', es: 'Voluntario', hi: 'स्वयंसेवक' },
    paperSub:       { en: 'Paper Submission', sw: 'Kuwasilisha Karatasi', fr: 'Soumission Article', ar: 'تقديم ورقة بحثية', zh: '论文提交', pt: 'Submissão de Artigo', es: 'Envío de Artículo', hi: 'पेपर सबमिशन' },
    received:       { en: 'Submission Received!', sw: 'Maombi Yamepokelewa!', fr: 'Dossier Reçu!', ar: 'تم استلام الطلب!', zh: '申请已收到！', pt: 'Pedido Recebido!', es: '¡Solicitud Recibida!', hi: 'आवेदन प्राप्त हुआ!' },
  },

  // ---- BLOG ----
  blog: {
    title:          { en: 'Legal Blog', sw: 'Blogu ya Kisheria', fr: 'Blog Juridique', ar: 'المدونة القانونية', zh: '法律博客', pt: 'Blog Jurídico', es: 'Blog Legal', hi: 'कानूनी ब्लॉग' },
    readMore:       { en: 'Read More', sw: 'Soma Zaidi', fr: 'Lire Plus', ar: 'اقرأ المزيد', zh: '阅读更多', pt: 'Leia Mais', es: 'Leer Más', hi: 'और पढ़ें' },
    leaveComment:   { en: 'Leave a Comment', sw: 'Acha Maoni', fr: 'Laisser un Commentaire', ar: 'اترك تعليقاً', zh: '留言评论', pt: 'Deixar Comentário', es: 'Dejar Comentario', hi: 'टिप्पणी छोड़ें' },
    comments:       { en: 'Comments', sw: 'Maoni', fr: 'Commentaires', ar: 'التعليقات', zh: '评论', pt: 'Comentários', es: 'Comentarios', hi: 'टिप्पणियां' },
    minRead:        { en: 'min read', sw: 'dak. kusoma', fr: 'min de lecture', ar: 'دقيقة قراءة', zh: '分钟阅读', pt: 'min de leitura', es: 'min de lectura', hi: 'मिनट पढ़ें' },
    moderated:      { en: 'Comments are moderated before publication.', sw: 'Maoni yanachunguzwa kabla ya kuchapishwa.', fr: 'Les commentaires sont modérés avant publication.', ar: 'يتم مراجعة التعليقات قبل النشر.', zh: '评论在发布前会经过审核。', pt: 'Comentários são moderados antes da publicação.', es: 'Los comentarios son moderados antes de publicarse.', hi: 'प्रकाशन से पहले टिप्पणियां संयमित की जाती हैं।' },
  },

  // ---- FOOTER ----
  footer: {
    practiceAreas:  { en: 'Practice Areas', sw: 'Maeneo ya Sheria', fr: 'Domaines de Droit', ar: 'مجالات القانون', zh: '业务领域', pt: 'Áreas de Prática', es: 'Áreas de Práctica', hi: 'अभ्यास क्षेत्र' },
    quickLinks:     { en: 'Quick Links', sw: 'Viungo Haraka', fr: 'Liens Rapides', ar: 'روابط سريعة', zh: '快速链接', pt: 'Links Rápidos', es: 'Enlaces Rápidos', hi: 'त्वरित लिंक' },
    contactUs:      { en: 'Contact Us', sw: 'Wasiliana Nasi', fr: 'Contactez-Nous', ar: 'اتصل بنا', zh: '联系我们', pt: 'Fale Conosco', es: 'Contáctenos', hi: 'हमसे संपर्क करें' },
    rights:         { en: 'All rights reserved', sw: 'Haki zote zimehifadhiwa', fr: 'Tous droits réservés', ar: 'جميع الحقوق محفوظة', zh: '版权所有', pt: 'Todos os direitos reservados', es: 'Todos los derechos reservados', hi: 'सर्वाधिकार सुरक्षित' },
    privacy:        { en: 'Privacy Policy', sw: 'Sera ya Faragha', fr: 'Politique de Confidentialité', ar: 'سياسة الخصوصية', zh: '隐私政策', pt: 'Política de Privacidade', es: 'Política de Privacidad', hi: 'गोपनीयता नीति' },
    terms:          { en: 'Terms of Service', sw: 'Masharti ya Huduma', fr: 'Conditions d\'Utilisation', ar: 'شروط الخدمة', zh: '服务条款', pt: 'Termos de Serviço', es: 'Términos de Servicio', hi: 'सेवा की शर्तें' },
    disclaimer:     { en: 'Disclaimer', sw: 'Kanusho', fr: 'Avertissement', ar: 'إخلاء المسؤولية', zh: '免责声明', pt: 'Aviso Legal', es: 'Aviso Legal', hi: 'अस्वीकरण' },
    newsletter:     { en: 'Stay Informed', sw: 'Kuwa na Habari', fr: 'Restez Informé', ar: 'ابقَ على اطلاع', zh: '保持关注', pt: 'Fique Informado', es: 'Mantente Informado', hi: 'सूचित रहें' },
    newsletterSub:  { en: 'Subscribe to our newsletter for legal updates and firm news.', sw: 'Jiandikishe kwa habari za kisheria na habari za kampuni.', fr: 'Abonnez-vous à notre newsletter pour les mises à jour juridiques.', ar: 'اشترك في نشرتنا الإخبارية للحصول على تحديثات قانونية.', zh: '订阅我们的时事通讯以获取法律更新和公司新闻。', pt: 'Assine nossa newsletter para atualizações jurídicas.', es: 'Suscríbase a nuestro boletín para actualizaciones legales.', hi: 'कानूनी अपडेट के लिए हमारे न्यूज़लेटर की सदस्यता लें।' },
    subscribe:      { en: 'Subscribe', sw: 'Jiandikishe', fr: "S'abonner", ar: 'اشترك', zh: '订阅', pt: 'Assinar', es: 'Suscribirse', hi: 'सदस्यता लें' },
    bookConsult:    { en: 'Book a Consultation', sw: 'Hifadhi Ushauri', fr: 'Prendre Rendez-vous', ar: 'احجز استشارة', zh: '预约咨询', pt: 'Agendar Consulta', es: 'Reservar Consulta', hi: 'परामर्श बुक करें' },
  },

  // ---- STATUS LABELS ----
  status: {
    pending:        { en: 'Pending', sw: 'Inasubiri', fr: 'En Attente', ar: 'معلق', zh: '待处理', pt: 'Pendente', es: 'Pendiente', hi: 'लंबित' },
    under_review:   { en: 'Under Review', sw: 'Inachunguzwa', fr: 'En Cours d\'Examen', ar: 'قيد المراجعة', zh: '审核中', pt: 'Em Análise', es: 'En Revisión', hi: 'समीक्षाधीन' },
    accepted:       { en: 'Accepted', sw: 'Imekubaliwa', fr: 'Accepté', ar: 'مقبول', zh: '已接受', pt: 'Aceito', es: 'Aceptado', hi: 'स्वीकृत' },
    rejected:       { en: 'Rejected', sw: 'Imekataliwa', fr: 'Rejeté', ar: 'مرفوض', zh: '已拒绝', pt: 'Rejeitado', es: 'Rechazado', hi: 'अस्वीकृत' },
    completed:      { en: 'Completed', sw: 'Imekamilika', fr: 'Complété', ar: 'مكتمل', zh: '已完成', pt: 'Concluído', es: 'Completado', hi: 'पूर्ण' },
    confirmed:      { en: 'Confirmed', sw: 'Imethibitishwa', fr: 'Confirmé', ar: 'مؤكد', zh: '已确认', pt: 'Confirmado', es: 'Confirmado', hi: 'पुष्टि की गई' },
    cancelled:      { en: 'Cancelled', sw: 'Imeghairiwa', fr: 'Annulé', ar: 'ملغى', zh: '已取消', pt: 'Cancelado', es: 'Cancelado', hi: 'रद्द' },
  },

  // ---- GALLERY ----
  gallery: {
    title:          { en: 'Gallery', sw: 'Picha', fr: 'Galerie', ar: 'معرض الصور', zh: '图库', pt: 'Galeria', es: 'Galería', hi: 'गैलरी' },
    noImages:       { en: 'No images yet.', sw: 'Hakuna picha bado.', fr: 'Pas encore d\'images.', ar: 'لا صور بعد.', zh: '暂无图片。', pt: 'Sem imagens ainda.', es: 'Sin imágenes aún.', hi: 'अभी तक कोई छवि नहीं।' },
  },

  // ---- TEAM ----
  team: {
    title:          { en: 'Meet the Team', sw: 'Kutana na Timu', fr: 'Rencontrez l\'Équipe', ar: 'تعرف على الفريق', zh: '认识团队', pt: 'Conheça a Equipe', es: 'Conoce al Equipo', hi: 'टीम से मिलें' },
    bookConsult:    { en: 'Book Consultation', sw: 'Hifadhi Ushauri', fr: 'Réserver Consultation', ar: 'احجز استشارة', zh: '预约咨询', pt: 'Agendar Consulta', es: 'Reservar Consulta', hi: 'परामर्श बुक करें' },
    yearsExp:       { en: 'years experience', sw: 'miaka ya uzoefu', fr: 'ans d\'expérience', ar: 'سنوات خبرة', zh: '年经验', pt: 'anos de experiência', es: 'años de experiencia', hi: 'वर्षों का अनुभव' },
  },

  // ---- INSIGHTS ----
  insights: {
    title:          { en: 'Insights', sw: 'Maarifa', fr: 'Perspectives', ar: 'رؤى', zh: '洞察', pt: 'Perspectivas', es: 'Perspectivas', hi: 'अंतर्दृष्टि' },
    video:          { en: 'Video', sw: 'Video', fr: 'Vidéo', ar: 'فيديو', zh: '视频', pt: 'Vídeo', es: 'Video', hi: 'वीडियो' },
    audio:          { en: 'Audio', sw: 'Sauti', fr: 'Audio', ar: 'صوت', zh: '音频', pt: 'Áudio', es: 'Audio', hi: 'ऑडियो' },
    news:           { en: 'News', sw: 'Habari', fr: 'Actualités', ar: 'أخبار', zh: '新闻', pt: 'Notícias', es: 'Noticias', hi: 'समाचार' },
    article:        { en: 'Article', sw: 'Makala', fr: 'Article', ar: 'مقال', zh: '文章', pt: 'Artigo', es: 'Artículo', hi: 'लेख' },
  },

  // ---- STATS ----
  stats: {
    cases:          { en: 'Cases Handled', sw: 'Kesi Zilizoshughulikiwa', fr: 'Affaires Traitées', ar: 'القضايا المعالجة', zh: '处理案例', pt: 'Casos Atendidos', es: 'Casos Atendidos', hi: 'मामले संभाले गए' },
    experience:     { en: 'Years Experience', sw: 'Miaka ya Uzoefu', fr: "Années d'Expérience", ar: 'سنوات الخبرة', zh: '年经验', pt: 'Anos de Experiência', es: 'Años de Experiencia', hi: 'वर्षों का अनुभव' },
    offices:        { en: 'East Africa Offices', sw: 'Ofisi za Afrika Mashariki', fr: "Bureaux en Afrique de l'Est", ar: 'مكاتب أفريقيا الشرقية', zh: '东非办事处', pt: 'Escritórios na África Oriental', es: 'Oficinas en África Oriental', hi: 'पूर्वी अफ्रीका कार्यालय' },
    satisfaction:   { en: 'Client Satisfaction', sw: 'Kuridhika kwa Mteja', fr: 'Satisfaction Client', ar: 'رضا العملاء', zh: '客户满意度', pt: 'Satisfação do Cliente', es: 'Satisfacción del Cliente', hi: 'ग्राहक संतुष्टि' },
  },

  // ---- NEWSLETTER ----
  newsletter: {
    namePlaceholder: { en: 'Your name', sw: 'Jina lako', fr: 'Votre nom', ar: 'اسمك', zh: '您的姓名', pt: 'Seu nome', es: 'Tu nombre', hi: 'आपका नाम' },
    emailPlaceholder:{ en: 'Your email address', sw: 'Barua pepe yako', fr: 'Votre email', ar: 'بريدك الإلكتروني', zh: '您的邮箱', pt: 'Seu email', es: 'Tu correo', hi: 'आपका ईमेल' },
    successMsg:     { en: "You're subscribed! Check your email.", sw: 'Umejisajili! Angalia barua pepe yako.', fr: 'Abonné! Vérifiez vos emails.', ar: 'تم الاشتراك! تحقق من بريدك.', zh: '订阅成功！请查收邮件。', pt: 'Inscrito! Verifique seu email.', es: '¡Suscrito! Revisa tu correo.', hi: 'सदस्यता ली गई! अपना ईमेल जांचें।' },
    privacy:        { en: 'We respect your privacy. Unsubscribe at any time.', sw: 'Tunaheshimu faragha yako. Jiondoe wakati wowote.', fr: 'Nous respectons votre vie privée. Désabonnez-vous à tout moment.', ar: 'نحترم خصوصيتك. يمكنك إلغاء الاشتراك في أي وقت.', zh: '我们尊重您的隐私。随时取消订阅。', pt: 'Respeitamos sua privacidade. Cancele a qualquer momento.', es: 'Respetamos tu privacidad. Cancela en cualquier momento.', hi: 'हम आपकी गोपनीयता का सम्मान करते हैं। किसी भी समय सदस्यता रद्द करें।' },
  },

  // ---- VOLUNTEER ----
  volunteer: {
    title:          { en: 'Volunteer With Us', sw: 'Jitolee Nasi', fr: 'Bénévolat Avec Nous', ar: 'تطوع معنا', zh: '与我们一起志愿', pt: 'Seja Voluntário', es: 'Voluntariado', hi: 'हमारे साथ स्वयंसेवक बनें' },
    applyBtn:       { en: 'Apply as Volunteer', sw: 'Omba Kujitolea', fr: 'Postuler comme Bénévole', ar: 'التقدم كمتطوع', zh: '申请成为志愿者', pt: 'Candidatar como Voluntário', es: 'Aplicar como Voluntario', hi: 'स्वयंसेवक के रूप में आवेदन करें' },
  },

  // ---- COVERAGE MAP ----
  coverage: {
    title:          { en: 'Coverage Areas', sw: 'Maeneo ya Huduma', fr: 'Zones de Couverture', ar: 'مناطق التغطية', zh: '服务区域', pt: 'Áreas de Cobertura', es: 'Áreas de Cobertura', hi: 'कवरेज क्षेत्र' },
    ourLocations:   { en: 'Our Locations', sw: 'Maeneo Yetu', fr: 'Nos Emplacements', ar: 'مواقعنا', zh: '我们的地点', pt: 'Nossas Localizações', es: 'Nuestras Ubicaciones', hi: 'हमारे स्थान' },
  },

  // ---- CHATBOT ----
  chat: {
    title:          { en: 'OW Legal Assistant', sw: 'Msaidizi wa Kisheria wa OW', fr: 'Assistant Juridique OW', ar: 'المساعد القانوني OW', zh: 'OW法律助手', pt: 'Assistente Jurídico OW', es: 'Asistente Legal OW', hi: 'OW कानूनी सहायक' },
    online:         { en: 'Online', sw: 'Mtandaoni', fr: 'En ligne', ar: 'متصل', zh: '在线', pt: 'Online', es: 'En línea', hi: 'ऑनलाइन' },
    placeholder:    { en: 'Type your message…', sw: 'Andika ujumbe wako…', fr: 'Tapez votre message…', ar: 'اكتب رسالتك…', zh: '输入您的消息…', pt: 'Digite sua mensagem…', es: 'Escribe tu mensaje…', hi: 'अपना संदेश टाइप करें…' },
    welcome:        { en: "Hello! I'm the Oringe Waswa & Akude Advocates LLP virtual assistant. How can I help you today?", sw: 'Habari! Mimi ni msaidizi wa kidijitali wa Oringe Waswa & Akude Advocates LLP. Naweza kukusaidia vipi leo?', fr: 'Bonjour! Je suis l\'assistant virtuel d\'Oringe Waswa & Akude Advocates LLP. Comment puis-je vous aider?', ar: 'مرحباً! أنا المساعد الافتراضي لـ Oringe Waswa & Akude Advocates LLP. كيف يمكنني مساعدتك اليوم؟', zh: '您好！我是Oringe Waswa & Akude Advocates LLP的虚拟助手。今天我能为您做什么？', pt: 'Olá! Sou o assistente virtual de Oringe Waswa & Akude Advocates LLP. Como posso ajudá-lo hoje?', es: '¡Hola! Soy el asistente virtual de Oringe Waswa & Akude Advocates LLP. ¿Cómo puedo ayudarte hoy?', hi: 'नमस्ते! मैं Oringe Waswa & Akude Advocates LLP का वर्चुअल सहायक हूं। आज मैं आपकी कैसे मदद कर सकता हूं?' },
    quickReplies:   { en: ['Book appointment', 'Our services', 'Contact info', 'Track submission'], sw: ['Hifadhi miadi', 'Huduma zetu', 'Mawasiliano', 'Fuatilia maombi'], fr: ['Prendre RDV', 'Nos services', 'Coordonnées', 'Suivi dossier'], ar: ['احجز موعداً', 'خدماتنا', 'معلومات التواصل', 'تتبع الطلب'], zh: ['预约咨询', '我们的服务', '联系方式', '追踪申请'], pt: ['Agendar consulta', 'Nossos serviços', 'Contato', 'Rastrear pedido'], es: ['Reservar cita', 'Nuestros servicios', 'Contacto', 'Rastrear solicitud'], hi: ['अपॉइंटमेंट बुक करें', 'हमारी सेवाएं', 'संपर्क जानकारी', 'आवेदन ट्रैक करें'] },
  },
} as const

// ---- HELPER HOOK ----
export type TranslationKey = keyof typeof translations
export type TranslationSection = (typeof translations)[TranslationKey]

export function t(
  section: TranslationKey,
  key: string,
  locale: Locale = 'en'
): string {
  const sec = translations[section] as Record<string, Record<string, string>>
  const entry = sec?.[key]
  if (!entry) return key
  return entry[locale] || entry['en'] || key
}
