module.exports = {
  readAccess: (req, res, next) => {

    /* for now, all users can read all other users annotations */
    /* needed for widget panel, showing who has annotated this section */
    if (req.method !== 'GET') {
      return res.status(405).send('do not use methods other than GET on routes that are gated by readaccess middleware')
    }
    
    next()
  },
  writeAccess: (req, res, next) => {
    /* methodss should be PUT, POST, or DELETE only. So should expect a body */
    if (req.method === 'GET') {
      return res.status(405).send('do not use GET method on routes gated by write access middleware')
    }

    const body = req.body
    const username = req.user ? req.user.username : 'anonymouse'
    const queryAllIds = body.annotations.map(a => ({annotation_id: a.annotationID}))

    req.app.db.db.get('annotations').find({
      $or: queryAllIds,
    },{
      _id: 0,
      user: 1
    }).then(arr => arr.reduce((acc, curr) => (acc.indexOf(curr.user) >= 0 ? acc : acc.concat(curr.user)), []))
      .then(uniqueUsers => {
        /* currently, the logic of allowing users modify records  */
        if (uniqueUsers.length === 1 && uniqueUsers[0] === username) {
          next()
        } else {
          res.status(403).send(JSON.stringify({you: username, owners: uniqueUsers}))
        }
      })
  }
}