/* global Microdraw */
/* global paper */

/* but try to rely on these objects as little as possible */

const dbroot = '/api'
Microdraw.lastImageInfos = {}

const ToolSave = {
  save : (function(){

    const hash = function(str){
      return str.split('').reduce((letter,index)=>{
        letter = ((letter<<5)-letter) + index.charCodeAt(0)
        return letter&letter
      },0)
    }

    /**
     * @function annotationHash
     * @desc Calculates hash of given annotation
     * @param {object} annotation with name, type and path (e.g. from ImageInfo[currentImage].Regions[i]
     * @param {string} type (optional if given in annotation): type of annotation, e.g. 'Region', 'Text'...
     * @return {number} hash
     */
    const annotationHash = function(annotation, type){
      debugger
      const t = type ? type : annotation.type;
      if ( t === "Region" ) {
          const correctedPath = annotation.path.constructor !== Array
            ? JSON.parse(annotation.path.exportJSON())
            : annotation.path
          return hash(JSON.stringify([annotation.name, correctedPath]).toString(16));
      }
      return 'null';
    }

    const prepareRegionForDB = (region) =>{
      debugger
      return ({
        annotations : {
          path : {
            path : region.path.constructor === Array ?
              region.path :
              JSON.parse(region.path.exportJSON()),
            name : region.name,
          }
        },
        annotationID : region.annotationID,
        type : 'cortical_region',
        annotation_hash : annotationHash(region,'Region'),
        
        originalRe : region
      })
}
    const getImageMetadata = (otherProp,getTileUrlString)=>otherProp ? 
      Promise.resolve( otherProp ) : 
      /B[0-9]{2}\_[0-9]{4}/.exec(getTileUrlString) ?
        fetch(`/imageHash?brainID_sliceNumber=${/B[0-9]{2}\_[0-9]{4}/.exec(getTileUrlString)[0]}`)
          .then(res=>res.json())
          .then(json=>{
            if(json.response && json.response.numFound && json.response.numFound === 1){
              /* because solr search fields are snake cased, have to provide a translation */
              const { brain_id, section_id, id, ...rest } = json.response.docs[0]
              return Promise.resolve({
                brainID: brain_id,
                sectionID : section_id,
                id
              })
            }else{
              console.warn('> response from proxied solr',json)
              return Promise.reject('proxied response from solr failed')
            }
          }) :
        Promise.reject(`could not parse getTileUrl:${getTileUrlString}`)

    const copyFilterObj = (obj) => obj.map(o=>{
      const copy = Object.assign({},o)
      delete copy.originalRe
      return copy
    })
    
    const restToBackend = (metadata,oSave,oUpdate,oDelete,oUndelete) => Promise.all([
      fetch(dbroot,{
        method : 'POST',
        headers : { 'Content-Type' : 'application/json' },
        body : JSON.stringify({
          fileID :`${metadata.brainID}_${metadata.sectionID}` ,
          image_hash : metadata.id ,
          annotations : copyFilterObj(oSave)
        }),
        credentials : 'same-origin'
      })
        .then(res=>res.json())
        .then(json=>{
          oSave.forEach(obj=>{
            obj.originalRe.annotationID = json.find(savedA => savedA.annotation_hash == obj.annotation_hash).annotation_id
            obj.originalRe.hash = obj.annotation_hash
          })
          return Promise.resolve(json)
        }),

      fetch(dbroot,{
        method : 'POST',
        headers : { 'Content-Type' : 'application/json' },
        body : JSON.stringify({
          fileID :`${metadata.brainID}_${metadata.sectionID}` ,
          image_hash : metadata.id ,
          annotations : copyFilterObj(oUpdate)
        }),
        credentials : 'same-origin'
      })
        .then(res=>res.json())
        .then(json=>{
          oUpdate.forEach(obj=>{
            obj.originalRe.hash = obj.hash
          })
          return Promise.resolve(json)
        }),

      fetch(dbroot,{
        method : 'DELETE',
        headers : { 'Content-Type' : 'application/json' },
        body : JSON.stringify({
          fileID :`${metadata.brainID}_${metadata.sectionID}` ,
          image_hash : metadata.id ,
          annotations : copyFilterObj(oDelete)
        }),
        credentials : 'same-origin'
      })
        .then(res=>res.json()),

      fetch(dbroot,{
        method : 'PUT',
        headers : { 'Content-Type' : 'application/json' },
        body : JSON.stringify({
          fileID :`${metadata.brainID}_${metadata.sectionID}` ,
          image_hash : metadata.id ,
          annotations : copyFilterObj(oUndelete)
        }),
        credentials : 'same-origin'
      })
        .then(res=>res.json())
    ])

    const fzjSaveAnnotationToDB = function( currentImageInfos, lastImageInfos, currentImage, multiSaveFlag, _otherProperties ){
      return Promise.all( Object.keys( currentImageInfos ).map((key,index)=>{
        
        if( !multiSaveFlag && key !== currentImage ){
          return Promise.resolve([],[],[],[])
        }
        const currentSlice = currentImageInfos[ key ]
        const lastSavedState = lastImageInfos[ key ] ? lastImageInfos[ key ] : []
        const otherProp = _otherProperties ? _otherProperties[ index ] : undefined

        /* regions that do not currently have annotaitonIDs will be saved */

        const objsTobeSaved = currentSlice.Regions
          .filter(region=>!region.annotationID)
          .map(prepareRegionForDB)

        /* regions that do have annotationIDs
        AND the annotaitonIDs existed in lastSAvedStateSection
        will have their hash calculated ...
        if their hash changed, they will be updated */
        /* regardless if they were updated, this operation will also splice out
        the regions that exist in section, and also in lastSavedStateSection */
                    
        const objsTobeUpdated = lastSavedState
          .map(hRegion=>
            currentSlice.Regions
              .filter(region=>region.annotationID)
              .find(region=>region.annotationID === hRegion.annotationID))
          .filter(nullable=>nullable)
          .filter(region=>{
            debugger
            return annotationHash(region,'Region') !== region.hash
          })
          .map(prepareRegionForDB)
        
        /* regions that exist in lastImageInfos, but does not exist in Regions, 
        will be deleted */

        const objsTobeDeleted = lastSavedState
          .filter(hRegion=>
            currentSlice.Regions
              .filter(region=>region.annotationID)
              .findIndex(region=>region.annotationID === hRegion.annotationID) < 0 )
          .map(prepareRegionForDB)


        /* region that does not exist in lastImageInfos, but exists in Regions will be undeleted
        ...
        or could there be another reason why they might appear? 
        */
        
        const objsTobeUndeleted = currentSlice.Regions
          .filter(region=>region.annotationID)
          .filter(region=>
            lastSavedState
              .findIndex(hRegion=>hRegion.annotationID === region.annotationID) < 0)
          .map(prepareRegionForDB)

        return getImageMetadata( otherProp , currentSlice.source.getTileUrl.toString() )
          .then(metadata=> restToBackend( metadata, objsTobeSaved, objsTobeUpdated, objsTobeDeleted, objsTobeUndeleted ))
      }))
    }

    const tool = {
      /**
       * @function click
       * @desc save the annotations
       * @param {string} prevTool The previous tool to which the selection goes back
       * @returns {void}
       */
      click : function click() {
        Microdraw.selectRegion( null )
        fzjSaveAnnotationToDB( Microdraw.ImageInfo , Microdraw.lastImageInfos, Microdraw.currentImage, Microdraw.config.multiImageSave, Microdraw._otherProperties )
          .then(arrOfArr=>{

            //make a copy of lastImageInfos
            for(let key in Microdraw.ImageInfo){
              Microdraw.lastImageInfos[key] = Microdraw.ImageInfo[key].Regions.slice(0,Microdraw.ImageInfo[key].Regions.length)
            }

            /* saving resolved */
            const modifiedAnnotations = [0,0,0,0]
            arrOfArr.forEach((arr,sliceIdx)=>arr.forEach((el,opIdx)=>{
              modifiedAnnotations[opIdx % 4] += el.length
            }))

            // show dialog box with timeout
            const saveDialog = `Annotations saved.<br />New : (${modifiedAnnotations[0]})<br />Updated : (${modifiedAnnotations[1]})<br />Deleted : (${modifiedAnnotations[2]})<br />Undeleted : (${modifiedAnnotations[3]})`

            /* have a better way of displaying save data (?) */
            $('#saveDialog')
              .html(saveDialog)
              .fadeIn();
            setTimeout(function() {
              $("#saveDialog")
              .fadeOut(500);
            }, 5000);
          })
          .catch(e=>{
            $('#saveDialog')
              .html(`<span style = "color:red">An error had occured</span><br />${JSON.stringify(e)}`)
              .fadeIn();
            setTimeout(function() {
              $("#saveDialog")
              .fadeOut(500);
            }, 5000);
            /* saving threw error */
            console.warn(e)
          })
        Microdraw.backToSelect();
      }
    }

    return tool
  }())
}

const veryfiyImageHash = ( imageHash, getTileUrlString )=> 
  imageHash ? 
    Promise.resolve(imageHash) :
    /B[0-9]{2}\_[0-9]{4}/.exec(getTileUrlString) ?
      fetch(`/imageHash?brainID_sliceNumber=${/B[0-9]{2}\_[0-9]{4}/.exec(getTileUrlString)[0]}`)
        .then(res=>res.json())
        .then(json=>{
          if(json.response && json.response.numFound && json.response.numFound === 1){
            /* because solr search fields are snake cased, have to provide a translation */
            const { id, ...rest } = json.response.docs[0]
            return id ? Promise.resolve(id) : Promise.reject(`id field does not exist.${JSON.stringify(json.response.docs[0])}`)
          }else{
            console.warn('> response from proxied solr',json)
            return Promise.reject('proxied response from solr failed')
          }
        }) :
      Promise.reject(`could not parse getTileUrl${getTileUrlString}`)

const fzjLoadAnnotationFromDb = (imageHash, getTileUrlString) => 
  veryfiyImageHash(imageHash, getTileUrlString)
    .then(imageHash=>
      fetch(`${dbroot}?image_hash=${imageHash}` , { credentials : 'same-origin' })
        .then(res=>res.json()))


const fzjProcessFetchedArray = (array)=> array.map((item)=>({
  annotation : {
    name : item.annotation.path.name,
    path : item.annotation.path.path,
  },
  annotationID : item.annotation_id,
  hash : item.annotation_hash
}))

/* overwritting default microdraw load function */
Microdraw.microdrawDBLoad = function(){
  const index = Object.keys(Microdraw.ImageInfo).findIndex(key=>key===Microdraw.currentImage)
  const imageHash = Microdraw._otherProperties ? 
    index >=0 ?
      Microdraw._otherProperties[ index ].id : 
      undefined :
    undefined
  const getTileUrlString = Microdraw.ImageInfo[ Microdraw.currentImage ].source.getTileUrl.toString()

  /* loading annotation flag was never set to true anywhere? */
  return fzjLoadAnnotationFromDb( imageHash, getTileUrlString )
    .then(arr=>{
      Microdraw.annotationLoadingFlag = false
      if( Microdraw.section !== Microdraw.currentImage ){
        return Microdraw.microdrawDBLoad()
      }else{
        Microdraw.lastImageInfos[ Microdraw.currentImage.toString() ] = fzjProcessFetchedArray(arr)
        return Promise.resolve( fzjProcessFetchedArray(arr) )
      }
    })
}