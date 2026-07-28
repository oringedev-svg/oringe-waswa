'use client'
import { forwardRef } from 'react'
import dynamic from 'next/dynamic'
import type { MDXEditorMethods, MDXEditorProps } from '@mdxeditor/editor'

// MDXEditor is built on Lexical, which touches `document`/`window` at module
// scope, it must never run during SSR. This dynamic import with ssr:false
// is the MDXEditor-documented way to load it inside the App Router.
const Editor = dynamic(() => import('./InitializedMDXEditor'), { ssr: false })

const MarkdownEditor = forwardRef<MDXEditorMethods, MDXEditorProps>((props, ref) => (
  <Editor {...props} ref={ref} />
))
MarkdownEditor.displayName = 'MarkdownEditor'

export default MarkdownEditor
