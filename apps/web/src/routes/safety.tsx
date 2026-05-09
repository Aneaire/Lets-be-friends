import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/safety')({ component: SafetyPage })

function SafetyPage() {
  const rules = ['18+ only for MVP', 'Friend Hosts require verification and admin approval before discovery', 'Members verify before sending real booking requests', 'Exact meeting details unlock only after accepted bookings', 'Every profile, post, message, booking, and review is reportable']
  return <main className="mx-auto max-w-4xl px-5 py-12"><h1 className="text-4xl font-black text-emerald-950">Safety is the product</h1><p className="mt-4 text-stone-600">Let's Be Friends is designed around trust gates, admin review, and clear boundaries.</p><ul className="mt-8 space-y-3">{rules.map(rule => <li className="rounded-2xl bg-white p-4 shadow-sm" key={rule}>✓ {rule}</li>)}</ul></main>
}
