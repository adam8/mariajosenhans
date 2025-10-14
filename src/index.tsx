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
  return c.html(`
    <!DOCTYPE html>
<html lang="en" class=""><head>
    <meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, minimal-ui, initial-scale=1">
    <title>MARIA JOSENHANS - HOME </title>
		
    <link rel="stylesheet" href="/css/jquery.fancybox.css?v=2.1.5" type="text/css" media="screen">
    <!-- <link rel="stylesheet" href="https://yui.yahooapis.com/pure/0.5.0-rc-1/pure-min.css">-->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/purecss@3.0.0/build/pure-min.css" integrity="sha384-X38yfunGUhNzHpBaEBsWLO+A0HDYOQi8ufWDkZ0k9e0eXz/tH3II7uKZ9msv++Ls" crossorigin="anonymous"> 
    
    <!-- <link rel="stylesheet" href="https://yui.yahooapis.com/pure/0.5.0-rc-1/grids-responsive-min.css"> -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/purecss@1.0.0/build/grids-responsive-min.css">


    <link href="https://fonts.googleapis.com/css?family=Lato:400,700" rel="stylesheet" type="text/css">
    <link rel="stylesheet" type="text/css" href="/css/styles-mariajosenhans2.css" media="screen">

    

    
  <style type="text/css">.fancybox-margin{margin-right:0px;}</style></head>

  <body data-page-id="home" class="home" style="">
    <div id="layout">
			
	    <a href="#menu" id="menuLink" class="menu-link">
        <!-- Hamburger icon -->
        <span></span>
	    </a> 
		
	 		<div id="menu">
         <div class="pure-menu pure-menu-open">
            
							
	                    
	                  </ul>
	                </li>
	              
	                <li data-id="home" id="nav-home" class="nav-li-active">
	                  <a class="admin-toggle" href="/">Home</a>
	                  <ul>
	                    
	                  </ul>
	                </li>
	              
	                <li data-id="available-paintings" id="nav-available-paintings">
	                  <a class="admin-toggle" href="/available-paintings/">AVAILABLE PAINTINGS</a>
	                  <ul>
	                    
	                      
	                        <li data-id="landscapes--large" id="nav-landscapes--large">
	                          <a class="admin-toggle" href="/landscapes--large/">landscapes | large</a>
	                        </li>
	                      
	                        <li data-id="plein-air--small" id="nav-plein-air--small">
	                          <a class="admin-toggle" href="/plein-air--small/">plein air | small</a>
	                        </li>
	                      
	                        <li data-id="drawings" id="nav-drawings">
	                          <a class="admin-toggle" href="/drawings/">drawings</a>
	                        </li>
	                      
	                    
	                  </ul>
	                </li>
	              
	                <li data-id="gallery-representation" id="nav-gallery-representation">
	                  <a class="admin-toggle" href="/gallery-representation/">GALLERY REPRESENTATION</a>
	                  <ul>
	                    
	                  </ul>
	                </li>
	              
	                <li data-id="archive" id="nav-archive">
	                  <a class="admin-toggle" href="/archive/">ARCHIVE</a>
	                  <ul>
	                    
	                  </ul>
	                </li>
	              
	                <li data-id="workshops" id="nav-workshops">
	                  <a class="admin-toggle" href="/workshops/">WORKSHOPS</a>
	                  <ul>
	                    
	                  </ul>
	                </li>
	              
	                <li data-id="news--events" id="nav-news--events">
	                  <a class="admin-toggle" href="/news--events/">NEWS &amp; EVENTS</a>
	                  <ul>
	                    
	                  </ul>
	                </li>
	              
	                <li data-id="about" id="nav-about">
	                  <a class="admin-toggle" href="/about/">ABOUT</a>
	                  <ul>
	                    
	                  </ul>
	                </li>
	              
	                <li data-id="contact" id="nav-contact">
	                  <a class="admin-toggle" href="/contact/">CONTACT</a>
	                  <ul>
	                    
	                  </ul>
	                </li>
	              
							</ul>
            
          </div>
			</div>
			
			
			
			
      <div id="header" class="pure-g">
				<div class="pure-u-1 pure-u-md-3-4"></div>
				<div id="logo-container" class="pure-u-1 pure-u-md-1-4">
					<a id="logo" href="/"><img src="/img/maria-josenhans-signature.gif" class="pure-img" alt="Maria Josenhans"></a>
			 	</div>
    	</div>
			
			
			

    	<div class="pure-g">
    		<div class="pure-u-1 pure-u-md-3-4">
    			

				<div id="content">       
            <!-- begin content block -->
            

  <h1 class="page-title">Home</h1>
  
  
  
  <div id="page-text"><p><img src="https://lh3.googleusercontent.com/TQfg-RHfUJ_q5ViD2Rc2OCLjW4Y8GMBjpLE2CmSGlhnDsgXQNu2UYM2-dbXbDsdVlOydX_nTyNUN-ZkrNXel4j3TLCLM4Q=s1000"></p></div> 
  
  
  

            <!-- #end content block -->
    			</div>


    		</div>

        
    
        <div class="pure-u-1 pure-u-md-1-4">
          
      		<div id="pure-menu-maria" class="pure-menu pure-menu-open">
            
							
	                    
	                  <ul>
	              
	                <li data-id="home" id="nav-home" class="nav-li-active">
	                  <a class="admin-toggle" href="/">Home</a>
	                  <ul>
	                    
	                  </ul>
	                </li>
	              
	                <li data-id="available-paintings" id="nav-available-paintings">
	                  <a class="admin-toggle" href="/available-paintings/">AVAILABLE PAINTINGS</a>
	                  <ul>
	                    
	                      
	                        <li data-id="landscapes--large" id="nav-landscapes--large">
	                          <a class="admin-toggle" href="/landscapes--large/">landscapes | large</a>
	                        </li>
	                      
	                        <li data-id="plein-air--small" id="nav-plein-air--small">
	                          <a class="admin-toggle" href="/plein-air--small/">plein air | small</a>
	                        </li>
	                      
	                        <li data-id="drawings" id="nav-drawings">
	                          <a class="admin-toggle" href="/drawings/">drawings</a>
	                        </li>
	                      
	                    
	                  </ul>
	                </li>
	              
	                <li data-id="gallery-representation" id="nav-gallery-representation">
	                  <a class="admin-toggle" href="/gallery-representation/">GALLERY REPRESENTATION</a>
	                  <ul>
	                    
	                  </ul>
	                </li>
	              
	                <li data-id="archive" id="nav-archive">
	                  <a class="admin-toggle" href="/archive/">ARCHIVE</a>
	                  <ul>
	                    
	                  </ul>
	                </li>
	              
	                <li data-id="workshops" id="nav-workshops">
	                  <a class="admin-toggle" href="/workshops/">WORKSHOPS</a>
	                  <ul>
	                    
	                  </ul>
	                </li>
	              
	                <li data-id="news--events" id="nav-news--events">
	                  <a class="admin-toggle" href="/news--events/">NEWS &amp; EVENTS</a>
	                  <ul>
	                    
	                  </ul>
	                </li>
	              
	                <li data-id="about" id="nav-about">
	                  <a class="admin-toggle" href="/about/">ABOUT</a>
	                  <ul>
	                    
	                  </ul>
	                </li>
	              
	                <li data-id="contact" id="nav-contact">
	                  <a class="admin-toggle" href="/contact/">CONTACT</a>
	                  <ul>
	                    
	                  </ul>
	                </li>
	              
							</ul>
            
          </div>
    
          <div id="mc_embed_signup">
            <form class="pure-form" action="https://mariajosenhans.us1.list-manage.com/subscribe/post?u=4cc80f8e321faadb6b3a073f5&amp;id=597e669ec0" method="post" id="mc-embedded-subscribe-form" name="mc-embedded-subscribe-form" target="_blank" novalidate="">
            <h1>Maria Josenhans</h1>
              <div class="mc-field-group" id="mailchimp-email-field">
              	<input type="email" style="max-width:100%;" value="" placeholder="Enter email" name="EMAIL" class="required email" id="mce-EMAIL" />
                <input type="submit" value="Join Email List" name="subscribe" id="mc-embedded-subscribe" class="pure-button" />
              </div>
            	<div id="mce-responses" class="clear">
            		<div class="response" id="mce-error-response" style="display:none"></div>
            		<div class="response" id="mce-success-response" style="display:none"></div>
            	</div>	
            </form>
          </div>

        </div>
				
      </div>

    </div>

    <script type="text/javascript" async="" src="https://www.googletagmanager.com/gtag/js?id=G-NSN4P68E6D&amp;cx=c&amp;_slc=1"></script><script async="" src="//www.google-analytics.com/analytics.js"></script><script src="https://ajax.googleapis.com/ajax/libs/jquery/1.11.0/jquery.min.js"></script>
		<script src="/js/ui-side-menu.js"></script> 
    <script>
      var page_id = $('body').data('page-id');
      $('#nav-'+page_id).addClass('nav-li-active');
			$('#menu .pure-menu').html($('#pure-menu-maria').html());
		</script>

     
  <script type="text/javascript" src="/js/jquery.fancybox.pack.js"></script>
  <script>
    $(document).ready(function() {
    	$(".fancybox").fancybox({
        padding : 0,
        margin: [20, 60, 20, 60], // Increase left/right margin to put nav arrows outside
        type: 'image',
        border: 0,
        openEffect: 'none',
        closeEffect: 'none',
        nextEffect: 'fade',
        prevEffect: 'fade',
        helpers : { 
          overlay : {
            css : {
              'background' : 'rgba(255, 255, 255, 0.9)'
            }
          }
        }
    	});
    });
  </script>

		
	
</body></html>`
  );

  
  // const db: D1Database = c.env.DB
  // if (!db) {
  //   console.warn('DB binding is not available.')
  //   c.render(<div>Database not available in this environment</div>)
  // }

  // const page = await db
  //   .prepare('SELECT * FROM Pages WHERE slug = ? LIMIT 1')
  //   .bind('home')
  //   .first<Pages>()

  // if (!page) return c.render(<div>"Home" page not found</div>)

  // return c.render(
  //   <div>
  //       {renderNav(db, false, 'home')}
  //       <div class="page">
  //         <div class="page-content">{raw(page.content)}</div>
  //         <div class="page-meta"><a href={`/admin/page/edit/${page.slug}`} class="admin-link">admin</a></div>
  //       </div>
  //     </div>
  // )
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
      <div id="mc_embed_signup">
        <form class="pure-form" action="https://mariajosenhans.us1.list-manage.com/subscribe/post?u=4cc80f8e321faadb6b3a073f5&amp;id=597e669ec0" method="post" id="mc-embedded-subscribe-form" name="mc-embedded-subscribe-form" target="_blank" novalidate="">
        <h1>Maria Josenhans</h1>
          <div class="mc-field-group" id="mailchimp-email-field">
            <input type="email" style="max-width:100%;" value="" placeholder="Enter email" name="EMAIL" class="required email" id="mce-EMAIL" />
            <input type="submit" value="Join Email List" name="subscribe" id="mc-embedded-subscribe" class="pure-button" />
          </div>
          <div id="mce-responses" class="clear">
            <div class="response" id="mce-error-response" style="display:none"></div>
            <div class="response" id="mce-success-response" style="display:none"></div>
          </div>	
        </form>
      </div>
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
