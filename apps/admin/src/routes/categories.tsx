import { createFileRoute } from '@tanstack/react-router'
import { activityCategories, friendStrengths } from '@lets-be-friends/shared'

export const Route = createFileRoute('/categories')({ component: CategoriesPage })

function CategoriesPage() {
  return (
    <>
      <header className="admin-page-header">
        <div>
          <p className="eyebrow">Category guide</p>
          <h1 className="text-h1 mt-2">Categories</h1>
          <p className="lede mt-2">These are the suggested activity categories and Strengths. Members can add their own activity categories when setting up a profile.</p>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="panel">
          <div className="panel-header">
            <h2 className="text-h2">Activity categories</h2>
            <span className="text-meta tabular">{activityCategories.length}</span>
          </div>
          <div className="panel-body">
            <div className="flex flex-wrap gap-2">
              {activityCategories.map((category) => <span key={category} className="chip">{category}</span>)}
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <h2 className="text-h2">Strengths</h2>
            <span className="text-meta tabular">{friendStrengths.length}</span>
          </div>
          <div className="panel-body">
            <div className="flex flex-wrap gap-2">
              {friendStrengths.map((strength) => <span key={strength} className="chip">{strength}</span>)}
            </div>
          </div>
        </section>
      </div>
    </>
  )
}
