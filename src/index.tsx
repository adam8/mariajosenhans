import { Hono } from 'hono'
import { raw } from 'hono/html';
import { renderer } from './renderer'
import { basicAuth } from 'hono/basic-auth'
import Nav from './nav'
// import { env } from 'hono/adapter'

interface Env {
  DB: D1Database;
  SECRET: string; // if you use c.env.SECRET in basicAuth
  PUBLIC_ASSETS?: {
    fetch: (requestOrPath: Request | string, init?: RequestInit) => Promise<Response>
  }
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

interface Pic {
  id?: number;
  page_id: number;
  filename: string;
  caption?: string | null;
  sequence?: number;
  created_at?: string;
  updated_at?: string;
}

async function getPicsForPage(db: D1Database, pageId: number) {
  const res = await db
    .prepare('SELECT id, page_id, filename, caption, sequence, created_at FROM Pics WHERE page_id = ? ORDER BY sequence, id')
    .bind(pageId)
    .all<Pic>();
  return res.results ?? [];
}

const app = new Hono<{ Bindings: Env }>(); // CloudflareBindings

app.use(renderer)

// app.get('/about*', async (c) => {
//   return c.render(<div>hola</div>);
//   // const assets = c.env.PUBLIC_ASSETS;
//   // if (!assets) {
//   //   return c.render(<div>About page (static assets not configured)</div>);
//   // }

//   // const res = await assets.fetch('/about/index.html');
//   // if (res.status === 404) return c.render(<div>About page not found, eh</div>);
//   // return res;
// });

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
      <div class="page">
        {renderAdminBanner()}
        {renderNav(db, true, 'admin')}
        <h1>Admin</h1>
        <button class="button button-submit" type="button" onclick="window.location.href='/admin/page/create'">Create New Page</button>
      </div>
    )
  } catch (error) {
    return c.render(<div>Internal Server Error... DB query failed: {error}</div>)
  }
})

app.get('/admin/page/create', (c) => {
  const db = c.env.DB
  if (!db) {
    console.warn('DB binding is not available — running in fallback mode.')
    return c.render(<div>Database not available in this environment</div>)
  }

  return c.render(
    <div class="page">
      {renderNav(db, true, 'admin')}
      {renderAdminBanner()}
      <h1>Create New Page</h1>
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

app.get('/admin/page/edit/:slug', async (c) => {
  const db = c.env.DB
  if (!db) {
    console.warn('DB binding is not available — running in fallback mode.')
    return c.render(<div>Database not available in this environment</div>)
  }

  const slugParam = c.req.param('slug')
  if (!slugParam) {
    return c.render(<div>Missing page slug</div>)
  }

  try {
    const page = await db.prepare('SELECT * FROM Pages WHERE slug = ? LIMIT 1').bind(slugParam).first<Pages>()

    if (!page) {
      return c.render(<div>Page not found</div>)
    }

    const pics = await getPicsForPage(db, Number(page.id));


    return c.render(
      <div class="page">
        {renderAdminBanner()}
        {renderNav(db, true, slugParam)}
        <h1>Edit {page.title ?? ''}</h1>

        {pics.length === 0 ? (
          <div>No pictures yet</div>
        ) : (
          <div class="gallery-grid">
            {pics.map((pic) => (
              <div class="gallery-item" key={pic.id}>
                <img src={pic.filename.startsWith('/') ? pic.filename : `/${pic.filename}`} alt={pic.caption ?? ''} />
                {pic.caption && <div class="caption">{pic.caption}</div>}
                {/* optional: small delete form/button per-image (you'd need to add a DELETE handler route) */}
              </div>
            ))}
          </div>
        )}
        <button class="button" type="button">Add Image</button>
        
        <form class="admin-page-form" method="post" action={`/admin/page/edit/${slugParam}`}>
          <input type="hidden" name="id" value={page.id} />
          <label>
            <div class="form-label">Title</div>
            <input required name="title" type="text" value={page.title ?? ''} />
          </label>
          <label>
            <div class="form-label">Content</div>
            <textarea id="admin-content-textarea" name="content" rows={8} cols={60}>{page.content ?? ''}</textarea>
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
          action={`/admin/page/delete/${slugParam}`}
          class="buttons"
          method="post"
          onsubmit="return confirm('Are you sure you want to delete this page? This cannot be undone.')">
          <button class="button button-delete" type="submit">Delete Page</button>
        </form>
        {page.updated_at && (
          <div class="page-meta">Last updated: {page.updated_at}</div>
        )}
      </div>
    )
  } catch (err) {
    console.error('DB fetch failed:', err)
    return c.render(<div>Internal Server Error</div>)
  }
})

app.post('/admin/page/edit/:slug', async (c) => {
  const db = c.env.DB
  if (!db) {
    console.warn('DB binding is not available — running in fallback mode.')
    return c.render(<div>Database not available in this environment</div>)
  }

  const form = await c.req.formData()
  const id = (form.get('id') as string) ?? ''
  const idNumber = Number(id)
    if (Number.isNaN(idNumber)) {
      return c.render(<div>Invalid page id</div>)
    }

  const title = (form.get('title') as string) ?? ''
  const content = (form.get('content') as string) ?? ''
  const slugRaw = (form.get('slug') as string) ?? 'home'
  const sequence = Number(form.get('sequence') ?? 0)

  // Normalize slug (optional — keep or replace with different slug logic)
  const slug = slugRaw
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]/g, '')

  try {
    await db
      .prepare('UPDATE Pages SET title = ?, content = ?, slug = ?, sequence = ?, updated_at = CURRENT_TIMESTAMP WHERE slug = ?')
      .bind(title, content, slug, sequence, slugRaw)
      .run()

    return c.redirect('/admin')
  } catch (err: any) {
    console.error('DB update failed:', err)
    // If slug uniqueness causes a constraint error, you can detect it from err.message and show a friendly message.
    return c.render(<div>Internal Server Error... DB update failed.</div>)
  }
})

app.post('/admin/page/delete/:slug', async (c) => {
  const db = c.env.DB
  if (!db) {
    console.warn('DB binding is not available — running in fallback mode.')
    return c.render(<div>Database not available in this environment</div>)
  }

  const slugParam = c.req.param('slug')
  if (!slugParam) {
    return c.render(<div>Missing page slug</div>)
  }

  try {
    await db.prepare('DELETE FROM Pages WHERE slug = ?').bind(slugParam).run()

    return c.redirect('/admin')
  } catch (err: any) {
    console.error('DB delete failed:', err)
    return c.render(<div>Internal Server Error... could not delete page.</div>)
  }
})

app.get('/:slug', async (c) => {
  const db = c.env.DB
  if (!db) {
    console.warn('DB binding is not available — running in fallback mode.')
    return c.render(<div>Database not available in this environment</div>)
  }

  const slug = c.req.param('slug')
  if (!slug) return c.render(<div>Missing slug</div>)

  try {
    const page = await db
      .prepare('SELECT * FROM Pages WHERE slug = ? LIMIT 1')
      .bind(slug)
      .first<Pages>()

    if (!page) return c.render(<div>Page not found</div>)

    return c.render(
      <div>
        {renderNav(db, false, slug)}
        <div class="page">
          <div class="page-content">{raw(page.content)}</div>
          <div class="page-meta">
            <a href={`/admin/page/edit/${page.slug}`} rel="nofollow" class="admin-link">admin</a>
          </div>
        </div>
      </div>
    )
  } catch (err) {
    console.error('DB fetch failed:', err)
    return c.render(<div>Internal Server Error</div>)
  }
})

app.get('/', async (c) => {
  const db: D1Database = c.env.DB
  if (!db) {
    console.warn('DB binding is not available.')
    c.render(<div>Database not available in this environment</div>)
  }

  const page = await db
    .prepare('SELECT * FROM Pages WHERE slug = ? LIMIT 1')
    .bind('home')
    .first<Pages>()

  if (!page) return c.render(<div>"Home" page not found</div>)

  return c.render(
    <div>
        {renderNav(db, false, 'home')}
        <div class="page">
          <div class="page-content">{raw(page.content)}</div>
          <div class="page-meta"><a href={`/admin/page/edit/${page.slug}`} class="admin-link">admin</a></div>
        </div>
      </div>
  )
})

const renderNav = async (db: D1Database, isAdmin: boolean, activePage: string) => {
  const res = await db.prepare('SELECT * FROM pages ORDER BY sequence').all()
  const adminPath = isAdmin == true ? '/admin/page/edit' : '';

  return (
    <div>
      <a href="#" class="page-nav-hamburger"><span /></a>
      <ul class="page-nav">
        {res.results?.map((page) => (
          <li class="page-nav-list-item" key={page.id}>
            <a href={`${adminPath}/${page.slug}`} class={activePage === page.slug ? 'active' : ''}>
              {page.title}
            </a>
          </li>
        ))}
        {isAdmin && (
          <li class="page-nav-list-item" key="live-website"><a href="/">👉 Live website</a></li>
        )}
      </ul>
      <div class="page-nav-blocker" />
    </div>
  )
}

const renderAdminBanner = () => {
  return (
    <div class="admin-banner">
      <p>
        <span style="margin-right: 20px">You are in admin mode </span>
        <button class="button button-submit" type="button" onclick="window.location.href='/admin/page/create'">Create New Page</button>
      </p>
    </div>
  )
}

export default app
