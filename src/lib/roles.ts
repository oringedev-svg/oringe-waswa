// Every role the app's own UI can select, shared by every /api/users route
// so the create, list, and update paths can never silently diverge again
// (this is what broke the role dropdown earlier: PATCH's own local copy of
// this list had fallen out of sync with the one the page actually offers).
export const ASSIGNABLE_ROLES = ['admin', 'staff', 'moderator', 'pupil', 'admin_assistant', 'client', 'public']
