const mustacheExpress = require('mustache-express');
const morgan = require('morgan')
const path = require('path')
const fs = require('fs')
const request = require('request')
const access = require('./routesFzjAccessControl')

morgan.token('user',(req,res) => req.user ? req.user.username : 'anonymouse')
const getAnnotationName = (body) => {
  try{
    return body.annotations[0].annotations.name
  }catch(e){
    return 'error parsing annotation'
  }
}
morgan.token('body',(req,res) => req.body || req.body === {} ? 
  `fileID=${req.body.fileID ? req.body.fileID : 'null'} image_hash=${req.body.image_hash ? req.body.image_hash : 'null'} annotation_name=${getAnnotationName(req.body)}` :
  'null' )

const fileStream = fs.createWriteStream( path.join( __dirname , 'access.log' ) , { flag : 'a' } )
process.on('beforeExit',() => {
  fileStream.close()
})
const morganMiddleWare = morgan(':date[iso] :method :url :user :body',{ stream : fileStream })

module.exports = (app) => {
    console.log(`configuring routes`)

    // view engine setup
    app.engine('mustache', mustacheExpress());
    app.set('views', path.join(__dirname,'../views'));
    app.set('view engine', 'mustache');

    // set pass app config to req
    const configSetup = (req,res,next) => {
        req.appConfig = {
            loginMethods : app.get('loginMethods') || [],
            db : app.db
        }
        next()
    }

    app.get('/', configSetup, function (req, res) { // /auth/github

      // store return path in case of login
      req.session.returnTo = req.originalUrl;
      res.render('index', {
          title: 'MicroDraw',
          loginMethods : app.get('loginMethods') || [],
          user: req.user ? req.user : null
      });
    });

    app.use('/data', configSetup, (req, res, next) => {
      next();
    } , configSetup, require('../controller/data/'));

    app.use('/user' , configSetup, require('../controller/user'));

    // API routes
    app.get('/api', configSetup, morganMiddleWare, access.readAccess, function (req, res) {

      console.warn("call to GET api");

      const { query = {}, user } = req
      const { image_hash, image_index = null } = query

      app.db.findAnnotations({
          image_hash,

          // image_index maybe 0, and Number(0) is falsy
          image_index: image_index !== null && Number(image_index) >= 0
            ? Number(image_index) 
            : { $exists: false },
          user : (user && user.username) || 'anonymouse'
      })
          .then(annotations=>res.status(200).send(
            annotations.map(a=>
              a.annotation_id ? 
                a :
                Object.assign({} , a , { annotation_id : a._id })  
            )))
          .catch(e=>res.state(500).send({err:JSON.stringify(e)}))
    });

    /**
     * save new annotation / update existing annoation
     */
    app.post('/api',configSetup, morganMiddleWare, access.writeAccess, (req,res)=>{

      console.log('post /api called (save/update)')

      const {
        annotations,
        ...rest
      } = req.body

      Promise.all(annotations.map(annotation=>
        app.db.updateAnnotation({
          annotation_hash : annotation.annotation_hash,
          user : req.user ? req.user.username : 'anonymouse',
          created_at : Date.now().toString(),
          annotation_id : annotation.annotationID,
          annotation : annotation.annotations,
          ...rest
        })))
          .then(array=>res.status(200).send(array))
          .catch(e=>res.status(500).send(JSON.stringify(e)))
    })

    /**
     * undelete annotations
     */
    app.put('/api',configSetup, morganMiddleWare, access.writeAccess, (req,res) => {

      console.log('put /api called (undelete) ')

      const {
        annotations
      } = req.body

      Promise.all(annotations.map(annotation=>
        app.db.undeleteAnnotation({
          _id : annotation._id,
          annotation_id : annotation.annotationID
        })
      ))
        .then(arr=>res.status(200).send(JSON.stringify(arr)))
        .catch(e=>res.status(500).send(e))
    })

    /**
     * delete annotation
     */
    app.delete('/api', configSetup, morganMiddleWare, access.writeAccess, (req,res)=>{

      console.log('delete /api called (delete)')
      
      const {
        annotations
      } = req.body

      Promise.all(annotations.map(annotation=>
        app.db.deleteAnnotation({
          _id : annotation._id,
          annotation_id : annotation.annotationID
        })
      ))
        .then(arr=>res.status(200).send(JSON.stringify(arr)))
        .catch(e=>res.status(500).send(e))
    })

    /* querying solr for unique brainID */
    app.get('/imageHash', (req,res)=>{
      const { brainID, sliceNumber,brainID_sliceNumber } = req.query
      if(brainID_sliceNumber){
        request(`http://imedv02.ime.kfa-juelich.de:8983/solr/inm_metadata_test/select?indent=on&q=path:*${brainID_sliceNumber}*&wt=json`)
          .pipe(res)
      }
      else if(brainID && sliceNumber){
        request(`http://imedv02.ime.kfa-juelich.de:8983/solr/inm_metadata_test/select?indent=on&q=path:*${brainID}_${sliceNumber}*&wt=json`)
          .pipe(res)
      }else{
        res.status(400).send('brainID and sliceNumber are required for querying of imageHash')
      }
    })

    app.get('/all', morganMiddleWare, access.readAccess, (req, res) => {
      app.db.findAnnotations({
        image_hash : req.query.image_hash
      })
        .then(annotations=>res.status(200).send(
          annotations.map(a=>
            a.annotation_id ? 
              a :
              Object.assign({} , a , { annotation_id : a._id })
          )))
        .catch(e=>res.state(500).send({err:JSON.stringify(e)}))
    })

    /* patches for bypassing CORS header restrictions */
    require('./routesExtensions')(app)
}