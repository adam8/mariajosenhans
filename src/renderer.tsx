import { jsxRenderer } from 'hono/jsx-renderer'

export const renderer = jsxRenderer(({ children }) => {
  return (
    <html>
      <head>
        <link href="/static/css/style.css" rel="stylesheet" />
      </head>
      <body>
        <div>{children}</div>
      </body>
    </html>
  )
})
