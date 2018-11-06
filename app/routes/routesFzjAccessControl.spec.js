const express = require('express')
const app = express()
const chai = require('chai')
const request = require('request')
const bodyParser = require('body-parser')
const expect = chai.expect

process.env.MONGODB_TEST_DEFAULT = `imedv02.ime.kfa-juelich.de:27018/microdraw_mocha_test`

const access = require('./routesFzjAccessControl')
const db = require('../db/dbFzj')

const dummyAnnotation1 = {
  "user" : "xgui",
  "annotation_id": "dummyAnnotation1"
}

const dummyAnnotation2 = {
  "user" : "xgui",
  "annotation_id": "dummyAnnotation2"
}

const dummyAnnotation3 = {
  "user" : "billyjane",
  "annotation_id": "dummyAnnotation3"
}

let server

const prG = (opt) => new Promise((resolve, reject) => {
  request('http://localhost:10001/dummyEndPoint', opt, (err, res, body) => {
    if (err) reject(err)
    else resolve({res, body})
  })
})

const parseIdToQueryBody = (ids) => ({
  annotations: ids.map(id => ({annotationID: `dummyAnnotation${id}`}))
})

describe('mocha started', () => {
  it('mocha works property', () => {
    expect(1).to.be.equal(1)
  })
})

describe('testing access control', () => {

  before(() => new Promise((resolve, reject) => {

    const parseTestHeader = (req, res, next) => {
      /* setting user via header. should only be used during tests */
      req.user = req.headers.user ? {username: req.headers.user} : null
      next()
    }

    app.use(bodyParser.json())

    app.get('/wrongEndPoint', access.writeAccess, (req, res) => res.status(200).send('ok'))
    app.post('/wrongEndPoint', access.readAccess, (req, res) => res.status(200).send('ok'))

    app.get('/dummyEndPoint', parseTestHeader, access.readAccess, (req, res) => {
      res.status(200).send('ok')
    })

    app.post('/dummyEndPoint', parseTestHeader, access.writeAccess, (req, res) => {
      res.status(200).send('ok')
    })

    app.delete('/dummyEndPoint', parseTestHeader, access.writeAccess, (req, res) => {
      res.status(200).send('ok')
    })

    app.put('/dummyEndPoint', parseTestHeader, access.writeAccess, (req, res) => {
      res.status(200).send('ok')
    })

    app.db = db

    Promise.all([
      db.db.get('annotations')
        .drop()
        .then(() => Promise.all([
            db.db.get('annotations').insert(dummyAnnotation1),
            db.db.get('annotations').insert(dummyAnnotation2),
            db.db.get('annotations').insert(dummyAnnotation3)
          ])),
      new Promise((rs,rj) => {
        server = app.listen(10001, () => {
          console.log('test listening on port 10001')
          rs()
        })
      })
    ])
      .then(resolve)
      .catch(reject)
  }))

  after(() => {
    db.db.close()
    server.close()
  })

  it('inserted the documents correctly, and they can be queried', (done) => {
    db.db.get('annotations').find({}, {_id: 0})
      .then(docs => {
        expect(docs.length).to.be.equal(3)

        const dummyArr = ['dummyAnnotation1','dummyAnnotation2','dummyAnnotation3']
        const findDoc = (doc) => {
          const index = dummyArr.findIndex(dummy => dummy === doc.annotation_id)
          dummyArr.splice(index, 1)
          return index >= 0
        }
        expect(docs.map(findDoc)).to.be.deep.equal([true, true, true])
        done()
      })
      .catch(done)
  })

  it('any user can GET resources', (done) => {

    Promise.all([
      prG({headers: {user: 'xgui'}}),
      prG({}),
      prG({headers: {user: 'billyjane'}})
    ])
      .then(arr => {
        expect(arr.map(item => item.res.statusCode)).to.be.deep.equal([200,200,200])
        done()
      })
      .catch(done)

  })

  describe('only users themselves can write to annotations', () => {
    it('user with the correct username can write to their own annotations', (done) => {
      prG({
        headers: {
          'Content-Type': 'application/json',
          'user': 'xgui'
        },
        method: 'POST',
        body: JSON.stringify(parseIdToQueryBody([1,2]))
      })
        .then(resp => {
          expect(resp.res.statusCode).to.be.equal(200)
          done()
        })
        .catch(done)
    })
    it('users with the incorrect username cannot write to annotations do not belong to them', (done) => {
      prG({
        headers: {
          'Content-Type': 'application/json',
          'user': 'xgui'
        },
        method: 'POST',
        body: JSON.stringify(parseIdToQueryBody([1,2,3]))
      })
        .then(resp => {
          expect(resp.res.statusCode).to.be.equal(403)
          done()
        })
        .catch(done)
    })
  })

  describe('incorrectly configured access control returns 405', () => {
    it('GET request with writeAccess access control returns 405', (done) => {
      request(`http://localhost:10001/wrongEndPoint`, (err, res, body) => {
        if (err) done(err)
        else {
          expect(res.statusCode).to.be.equal(405)
          done()
        }
      })
    })
    it('POST request with readAccess access control returns 405', (done) => {
      request('http://localhost:10001/wrongEndPoint',{
        method: 'POST'
      }, (err, res, body) => {
        if(err) done(err)
        else{
          expect(res.statusCode).to.be.equal(405)
          done()
        }
      })
    })
  })
})