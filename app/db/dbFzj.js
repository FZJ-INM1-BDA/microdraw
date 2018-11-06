const monk = require('monk')
const MONGODB = process.env.MONGODB || process.env.MONGODB_TEST_DEFAULT || '127.0.0.1:27017/microdraw'

module.exports = function(overwriteMongoPath){
    console.log(`connecting to mongodb at: ${MONGODB}`)
    
    const db = monk(overwriteMongoPath || MONGODB)
    let connected = false

    db.then(() => {
        connected = true
        console.log('conntected successfully')
    }).catch(e => {
        connected = false
        console.log('connection error', e)
    })

    /* add user */
    const addUser = (user)=>new Promise((resolve,reject)=>{
        db.get('users').insert(user)
            .then(()=>resolve(user))
            .catch(e=>reject(e))
    })

    const updateUser = (user)=>new Promise((resolve,reject)=>{
        db.get('users').update({
            username : user.username
        },{
            $set : user
        }).then(()=>resolve())
            .catch(e=>reject(e))
    })

    /* find user */
    const queryUser = (searchQuery)=>new Promise((resolve,reject)=>{
        db.get('users').findOne(searchQuery)
            .then((user)=>user ? resolve(user) : reject({message:'error find one user',result:user}))
            .catch(e=>reject(e))
    })

    const upsertUser = (user)=> new Promise((resolve,reject)=>{
        queryUser({
            nickname : user.username
        })
            .then(()=>updateUser(user))
            .then(()=>resolve())
            .catch(e=>{
                e.message === 'error find one user' ?
                    addUser(user)
                        .then(()=>resolve())
                        .catch(e=>reject(e)) :
                reject(e)
            })
            
    })

    const queryAllUsers = (pagination)=>new Promise((resolve,reject)=>{
        db.get('users').find(pagination)
            .then((users)=>users ? resolve(users) : reject({message : 'error find all users',result:users}))
            .catch(e=>reject(e))
    })

    /**
     * 
     * @param {Object} searchQuery having fields: fileID : string, user:string
     * @returns {Promise} to resolve as an array of annotations
     */
    const findAnnotations = (searchQuery) => new Promise((resolve,reject)=>{
        db.get('annotations').find(
            Object.assign({},searchQuery,{
                backup : { $exists : false }
            })
        )
            .then((annotations)=>
                annotations ? 
                    resolve(annotations) :
                    resolve([]))
            .catch(e=>reject(e))
    })

    /**
     * 
     * @param {Object} saveQuery having fields : fileID : string, user : string, annotationHash : string, annotation : JSON.stringify(Object { Regions : string[] }), hash : string
     * @returns {Promise} to resolve when saving is complete
     */
    const updateAnnotation = (saveQuery)=> new Promise((resolve,reject)=>{
        const { 
          image_hash,
          annotation_hash,
          user,
          fileID,
          created_at,
          annotation_id,
          annotation
        } = saveQuery

        db.get('annotations').update(
            Object.assign(
                {},
                { user },
                { $or : [ { _id : annotation_id } , { annotation_id } ] },
                { backup : { $exists : false } }),
            { $set : { backup : true, last_modified : Date.now().toString() } },
            { multi : true }
        ).then(()=>{
            db.get('annotations').insert({
              image_hash,
              annotation_hash,
              user,
              fileID,
              annotation_id,
              annotation,
              created_at,
              last_modified : Date.now().toString()
            })
              .then(json=>json.annotation_id ? 
                  json : 
                  db.get('annotations').findOneAndUpdate(
                    { _id : json._id } ,
                    Object.assign({} , json , { annotation_id : JSON.stringify(json._id.toString()) }) ,
                    { returnNewDocument : true }
                  )
                )
              .then(json=>resolve(json))
              .catch(e=>reject(e))
            // const allAnnotation = JSON.parse(annotation)
            // const arrayTobeSaved = allAnnotation.Regions.map(region=>({
            //     fileID , 
            //     user ,
            //     annotation_hash ,
            //     image_hash ,
            //     annotation ,
            //     created_at
            // }))
            // db.get('annotations').insert(arrayTobeSaved)
            //     .then(()=>resolve())
            //     .catch(e=>reject(e))
        })
    })

    /**
     * 
     */
    const deleteAnnotation = (query) => new Promise((resolve,reject)=>{
      const { 
        annotation_id,
        _id
      } = query

      db.get('annotations').findOneAndUpdate(Object.assign({}, {
        backup : {
          $exists : false
        }
      }, annotation_id
        ? { annotation_id }
        : { _id }
      ), {
        $set : {
          backup : true,
          last_modified : Date.now().toString(),
        }
      },{
        returnNewDocument : true
      })
        .then(json=>resolve(json))
        .catch(e=>reject(e))

    })
    /**
     * 
     */
    const undeleteAnnotation = (query) => new Promise((resolve,reject)=>{
      const { 
        annotation_id,
        _id
      } = query

      db.get('annotations').findOneAndUpdate(
        Object.assign({}, annotation_id ? { annotation_id } : { _id } ),
        {
          $set : {
            last_modified : Date.now().toString()        
          },
          $unset : {
            backup : ""
          }
        },{
          sort : {
            $natural : -1
          },
          returnNewDocument : true
        }
      )
        .then(json=>resolve(json))
        .catch(e=>reject(e))

    })


    /**
     * @returns {boolean} checks mongodb connection
     */
    const checkHealth = () => connected

    return {
        addUser,
        queryUser,
        queryAllUsers,
        findAnnotations,
        updateAnnotation,
        updateUser,
        upsertUser,
        deleteAnnotation,
        undeleteAnnotation,
        db,
        checkHealth
    }
    /* should discourage the use of db.db ... this renders it db specific ... */
}