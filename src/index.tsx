import { Hono } from 'hono'
import { renderer } from './renderer'
import { basicAuth } from 'hono/basic-auth'
// import { env } from 'hono/adapter'

interface Env {
  DB: D1Database;
  SECRET: string; // if you use c.env.SECRET in basicAuth
}

interface Pages {
  id?: number;
  title: string;
  content: string;
  slug: string;
  sequence: string;
  created_at?: string;
  updated_at?: string;
}

const app = new Hono<{ Bindings: Env }>(); // CloudflareBindings

app.use(renderer)

app.use('/admin/*', async (c, next) => {
  const auth = basicAuth({
    username: 'admin',
    password: c.env.SECRET,
  });

  return auth(c, next);
})

app.get('/admin', async(c) => {
  const db = c.env.DB
  if (!db) {
    console.warn('DB binding is not available — running in fallback mode.')
    c.render(<div>Database not available in this environment</div>)
  }

  try {
    const res = await db.prepare('SELECT * FROM pages ORDER BY sequence').all()

    return c.render(
      <div>
        <h1>Admin, <em> you are authorized!</em></h1>
        {res.results?.map((page) => (
          <a class="admin-page" key={page.id} href={`/admin/page/edit/${page.id}`}>{page.title}</a>
        ))}
        <div class="buttons">
          <button class="button button-submit" type="button" onclick="window.location.href='/admin/page/create'">Create New Page</button>
        </div>
      </div>
    )
  } catch (error) {
    return c.render(<div>Internal Server Error... DB query failed: {error}</div>)
  }
})

app.get('/admin/page/create', (c) => {
  return c.render(
    <div>
      <h1>Admin: Create Page</h1>
        <form method="post" action="/admin/page/create">
          <label>
            <div class="form-label">Title</div>
            <input required name="title" type="text" value="" />
          </label>
          <label>
            <div class="form-label">Content</div>
            <textarea name="content" rows={8} cols={60} />
          </label>
          <label>
            <div class="form-label">Slug</div>
            <input name="slug" type="text" value="" />
          </label>
          <label>
            <div class="form-label">Sequence</div>
            <input name="sequence" min="1" step="1" type="number" value="" />
          </label>
          <div class="buttons">
            <button class="button button-submit" type="submit">Save</button>
            <button class="button" type="button" onclick="window.location.href='/admin'">Cancel</button>
          </div>
        </form>
    </div>
  )
})

app.post('/admin/page/create', async (c) => {
  const db = c.env.DB
  if (!db) {
    console.warn('DB binding is not available — running in fallback mode.')
    return c.render(<div>Database not available in this environment</div>)
  }

  // Parse form data correctly (works for "application/x-www-form-urlencoded" and multipart)
  const form = await c.req.formData()
  const title = (form.get('title') as string) ?? ''
  const content = (form.get('content') as string) ?? ''
  const sequence = Number(form.get('sequence') ?? 0)

  const slug = title
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')         // spaces to dashes
    .replace(/[^\w-]/g, '')       // remove invalid chars

  try {
    await db.prepare('INSERT INTO pages (title, content, sequence, slug) VALUES (?, ?, ?, ?)')
      .bind(title, content, sequence, slug)
      .run()
    return c.redirect('/admin')
  } catch (error) {
    return c.render(<div>Internal Server Error... DB query failed: {error}</div>)
  }
})

app.get('/admin/page/edit/:id', async (c) => {
  const db = c.env.DB
  if (!db) {
    console.warn('DB binding is not available — running in fallback mode.')
    return c.render(<div>Database not available in this environment</div>)
  }

  const idParam = c.req.param('id')
  if (!idParam) {
    return c.render(<div>Missing page id</div>)
  }

  const id = Number(idParam)
  if (Number.isNaN(id)) {
    return c.render(<div>Invalid page id</div>)
  }

  try {
    const page = await db.prepare('SELECT * FROM Pages WHERE id = ? LIMIT 1').bind(id).first<Pages>()

    if (!page) {
      return c.render(<div>Page not found</div>)
    }

    return c.render(
      <div>
        <h1>Edit Page</h1>
        <form method="post" action={`/admin/page/edit/${id}`}>
          <label>
            <div class="form-label">Title</div>
            <input required name="title" type="text" value={page.title ?? ''} />
          </label>
          <label>
            <div class="form-label">Content</div>
            <textarea name="content" rows={8} cols={60}>{page.content ?? ''}</textarea>
          </label>
          <label>
            <div class="form-label">Slug</div>
            <input name="slug" type="text" value={page.slug ?? ''} />
          </label>
          <label>
            <div class="form-label">Sequence</div>
            <input name="sequence" min="1" step="1" type="number" value={String(page.sequence ?? 0)} />
          </label>
          <div class="buttons">
            <button class="button button-submit" type="submit">Update</button>
            <button class="button" type="button" onclick="window.location.href='/admin'">Cancel</button>
          </div>
        </form>
        <form
          action={`/admin/page/delete/${id}`}
          class="buttons"
          method="post"
          onsubmit="return confirm('Are you sure you want to delete this page? This cannot be undone.')">
          <button class="button button-delete" type="submit">Delete Page</button>
        </form>
      </div>
    )
  } catch (err) {
    console.error('DB fetch failed:', err)
    return c.render(<div>Internal Server Error</div>)
  }
})

app.post('/admin/page/edit/:id', async (c) => {
  const db = c.env.DB
  if (!db) {
    console.warn('DB binding is not available — running in fallback mode.')
    return c.render(<div>Database not available in this environment</div>)
  }

  const idParam = c.req.param('id')
  if (!idParam) return c.render(<div>Missing page id</div>)
  const id = Number(idParam)
  if (Number.isNaN(id)) return c.render(<div>Invalid page id</div>)

  // Parse form data (works for form POSTs)
  const form = await c.req.formData()
  const title = (form.get('title') as string) ?? ''
  const content = (form.get('content') as string) ?? ''
  const slugRaw = (form.get('slug') as string) ?? ''
  const sequence = Number(form.get('sequence') ?? 0)

  // Normalize slug (optional — keep or replace with different slug logic)
  const slug = slugRaw
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]/g, '')

  if (!title || !content) {
    return c.render(<div>Title and content are required</div>)
  }

  try {
    await db
      .prepare('UPDATE Pages SET title = ?, content = ?, slug = ?, sequence = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .bind(title, content, slug, sequence, id)
      .run()

    return c.redirect('/admin')
  } catch (err: any) {
    console.error('DB update failed:', err)
    // If slug uniqueness causes a constraint error, you can detect it from err.message and show a friendly message.
    return c.render(<div>Internal Server Error... DB update failed.</div>)
  }
})

app.post('/admin/page/delete/:id', async (c) => {
  const db = c.env.DB
  if (!db) {
    console.warn('DB binding is not available — running in fallback mode.')
    return c.render(<div>Database not available in this environment</div>)
  }

  const idParam = c.req.param('id')
  if (!idParam) {
    return c.render(<div>Missing page id</div>)
  }

  const id = Number(idParam)
  if (Number.isNaN(id)) {
    return c.render(<div>Invalid page id</div>)
  }

  try {
    await db.prepare('DELETE FROM Pages WHERE id = ?').bind(id).run()

    return c.redirect('/admin')
  } catch (err: any) {
    console.error('DB delete failed:', err)
    return c.render(<div>Internal Server Error... could not delete page.</div>)
  }
})

app.get('/:id', (c) => {
  const id = c.req.param('id')
  return c.render(<h1>Hello! id: {id}</h1>)
})

app.get('/', (c) => {
  return c.render(
    <div>
      <h1>Hello! Test again :)</h1>
      <a href="/admin">admin</a>
    </div>
  )
})

// app.post('/posts', (c) => c.text('Created!', 201))
// app.delete('/gage/:id', (c) =>
//   c.text(`${c.req.param('id')} is deleted!`)
// )

export default app
