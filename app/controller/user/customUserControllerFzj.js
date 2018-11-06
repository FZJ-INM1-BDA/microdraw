const path = require('path')

/* fzj specific routes (?) */
const checkAuthorised = (req,res,next)=>{
  if( 
    !req.user ||  
    (req.params.userName !== req.user.username && req.user.role !== 'admin')
  ){
    res.status(401).send('forbidden')
  }else{
    next()
  }
}

module.exports = (router)=>{

  router.all('/presetRegionNames',(req,res)=>{
    console.log('req,user',req.user)
    if( req.user ){
      res.redirect(path.join(req.baseUrl,req.user.username,'presetRegionNames'))
    }else{
      res.status(401).send('forbidden')
    }
  })
  
  router.get('/:userName/presetRegionNames',checkAuthorised,(req,res)=>{
    res.status(200).send( req.user.presetRegionNames ? JSON.stringify(req.user.presetRegionNames) : '[]')
  })
  
  router.put('/:userName/presetRegionNames',checkAuthorised,(req,res)=>{
    const { presetRegionNames } = req.body
    if( presetRegionNames && presetRegionNames.constructor === Array ){
      req.app.db.updateUser({
        username : req.user.username,
        presetRegionNames : presetRegionNames
      })
        .then(()=>res.status(200).send('ok'))
        .catch(e=>res.status(501).send(JSON.stringify(e)))
    }else{
      res.status(401).send('presetRegionNames needs to be an array')
    }
  })
}
