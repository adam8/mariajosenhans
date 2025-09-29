import { jsxRenderer } from 'hono/jsx-renderer';

export const renderer = jsxRenderer(({ children }) => {
  return (
    <html>
      <head>
        <link href="/static/css/style.css" rel="stylesheet" />
        <link href="/static/css/redactor.css" rel="stylesheet" />
        {/* <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/purecss@3.0.0/build/pure-min.css" integrity="sha384-X38yfunGUhNzHpBaEBsWLO+A0HDYOQi8ufWDkZ0k9e0eXz/tH3II7uKZ9msv++Ls" crossorigin="anonymous" /> */}
       
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta charSet="utf-8" />

        <title>Maria Josenhans</title>
        
        <script defer src="https://ajax.googleapis.com/ajax/libs/jquery/1.11.0/jquery.min.js"></script>
        <script defer type="module" src="/static/js/redactor.min.js"></script>
        <script defer type="module" src="/static/js/scripts.js"></script>
      </head>
      <body>
        <div class="page-header">
          <a class="page-logo" href="/">
            <img src="/static/img/maria-josenhans-signature.gif" alt="Maria Josenhans" />
          </a>
        </div>
        {children}
      </body>
    </html>
  )
})
