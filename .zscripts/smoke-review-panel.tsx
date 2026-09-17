// One-off smoke render of ReviewPanel (not wired into any view yet —
// another task mounts it). Verifies the component renders to static
// markup without crashing under its initial state.
import { renderToString } from 'react-dom/server'
import { createElement } from 'react'
import { ReviewPanel } from '../src/components/admin/shared/ReviewPanel'

const html = renderToString(
  createElement(ReviewPanel, {
    subject: 'Why automation matters',
    body: 'Our team has many years of experience building software for growing companies. We believe our revolutionary platform will be a game-changing addition to your workflow.',
    kind: 'blog',
  }),
)
console.log('rendered length:', html.length)
console.log('has AI Review button:', html.includes('AI Review'))
console.log('has SpellCheck icon markup:', html.includes('svg'))
if (!html.includes('AI Review')) throw new Error('ReviewPanel did not render its trigger button')
console.log('OK — ReviewPanel renders without crashing')
