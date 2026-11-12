# packages/feature-admin

The hidden admin, at `/admin`: sign-in with a password (and the first-time
password setup), then cards, packs, the history of changes and the reports
players sent. It shows cards through a `renderCard` prop the app provides:
this package doesn't depend on the game's. Depends only on `@zbeul/core`,
`@zbeul/api` and `@zbeul/ui`.

- Nothing on the public site links here, and the page is never indexed.
- What the page shows is only a convenience: the BFF checks the session and
  the admin flag on every admin route, and answers 404 to anyone else.
- A signed-in visitor who isn't the admin sees the app's "page not found".
- Data through the generated hooks; the route passes URL state (the report
  status) as props.
