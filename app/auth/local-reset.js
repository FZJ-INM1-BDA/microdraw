const LRU = require('lru-cache')
const nodeMailer = require('nodemailer')
const crypto = require('crypto')
const bodyParser = require('body-parser')
const csrf = require('csurf')
const md5 = require('md5')
const mysql = require('mysql')
const csrfProtection = csrf({
  cookie: true
})
const {
  MAIL_HOST,
  MAIL_USER,
  MAIL_PASS,
  MAIL_PORT,
  HOST_URL,

  MYSQL_HOST,
  MYSQL_USER,
  MYSQL_PASS,
  MYSQL_USERDB,
} = process.env

const SUBJECT = `Microdraw password reset`
module.exports = app => {
  if (!HOST_URL) {
    throw new Error(`HOST_URL must be defined for local-reset.js`)
  }
  const hostUrl = HOST_URL.replace(/\/+$/, '')
  const cache = new LRU({
    maxAge: 1000 * 60 * 30 // 30 min max age
  })

  const mysqlConnection = mysql.createConnection({
    host: MYSQL_HOST,
    user: MYSQL_USER,
    password: MYSQL_PASS,
    database: MYSQL_USERDB
  })
  
  const transport = nodeMailer.createTransport({
    host: MAIL_HOST,
    port: MAIL_PORT || 465,
    secure: false,
    auth: {
      user: MAIL_USER,
      pass: MAIL_PASS
    }
  })
  
  app.get('/reset', async (req, res) => {
    const { email } = req.query || {}
    if (!email) {
      res.status(400).send(`email is required`)
      return
    }
    const token = crypto.randomBytes(16).toString('hex')
    cache.set(token, { email })

    const text = `Reset password for ${email} .
    
If you did not request a password reset, you can safely ignore this email.

Go to the link below to reset your password.

${hostUrl}/resetCb&token=${token}

If you encounter any issue, feel free to email us at inm1-bda@fz-juelich.de
`

    const html = `Reset password for ${email} .<br><br>
If you did not request a password reset, you can safely ignore this email.<br><br>
<a href="${hostUrl}/resetCb&token=${token}">Click here</a> Or go to the link below to reset your password.<br><br>

${hostUrl}/resetCb&token=${token} <br><br>

If you encounter any issue, feel free to email us at inm1-bda@fz-juelich.de`

    try {

      await transport.sendMail({
        from: 'inm1-bda - microdraw <inm1-bda@fz-juelich.de>',
        to: email,
        subject: `${SUBJECT}`,
        text,
        html,
      })
      
      res.status(204).end()
    } catch (e) {
      res.status(500).end(e.toString())
    }
  })

  app.get('/resetCbForm', csrfProtection, (req, res) => {
    const { token } = req.query
    const { email } = cache.get(token) || {}
    if (!email) {
      res.status(404).send(`token / email not found`)
      return
    }
    cache.del(token)
    res.render('pswdreset', {
      email,
      csrfToken: req.csrfToken()
    })
  })

  app.post('/resetCb', bodyParser.urlencoded({ extended: false }), csrfProtection, async (req, res) => {
    const { email, password } = req.body
    /**
     * need to update mongodb as well as mysql db
     */
    let user
    try {
      user = await req.app.db.queryUser({ email })
      await req.app.db.updateUser({
        ...user,
        password: md5(password)
      })
    } catch (e) {
      console.error(e)
      res.status(400).send(`update mongo user failed, ${e.toString()}`)
      return
    }

    /**
     * update mysql db
     */
    mysqlConnection.query(
      `UPDATE Users SET Password = ? WHERE EmailAddress = ?`,
      [ md5(password), email ],
      (err, results, fields) => {
        if (err) {
          res.status(500).send(`mysql update failed. ${err.toString()}`)
          return
        }
        console.log('update mysql successful', { results, fields })
        res.status(200).send(`Password changed successfully`)
        return 
      }
    )

  })
}
