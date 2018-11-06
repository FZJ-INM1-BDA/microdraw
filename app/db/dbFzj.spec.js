const assert = require('assert')
const expect = require('chai').expect

process.env.MONGODB_TEST_DEFAULT = `imedv02.ime.kfa-juelich.de:27018/microdraw_mocha_test`

const db = require('./dbFzj')

describe('Mocha Started',()=>{
    it('Mocha works properly',()=>{
        assert.equal(1,1)
    })
})

describe('testing db.js',()=>{

    const dummyUser = {
        username : 'tommy jones',
        age : 14
    }
    const dummyUser2 = {
        username : 'jessica jones',
        age : 55
    }

    const dummyAnnotation2 = {
        "image_hash" : "7aa2e720173e5e418d4f5f664b3009b5e6a68444d51d4c79bc4b0f5c1c24469a68d16301bb683d73715bba93d12f1909eaa5f54d94a8c6b65b7ce23599f3ad58",
        "annotation_hash" : -1510626204,
        "user" : "xgui",
        "fileID" : "B20_4497",
        "annotation" : {
            "path" : {
                "path" : [ 
                    "Path", 
                    {

                    }
                ],
                "name" : "dummy annotation 2"
            }
        },
    }

    const dummyAnnotation1 = {
        "image_hash" : "9a7c195ba85d850314c3fd3586f982a8998d9e191395eb470297145ef5f766649bfcf1b88ada72de9d8c59c4c7bab45450b22b5dc60af2ad1a12bc7ceb74ded2",
        "annotation_hash" : -1510626204,
        "user" : "xgui",
        "fileID" : "B21_4826",
        "annotation" : {
            "path" : {
                "path" : [ 
                    "Path", 
                    {

                    }
                ],
                "name" : "Untitled 1"
            }
        },
    }
    
    const dummyAnnotation1_edited = {
        "image_hash" : "9a7c195ba85d850314c3fd3586f982a8998d9e191395eb470297145ef5f766649bfcf1b88ada72de9d8c59c4c7bab45450b22b5dc60af2ad1a12bc7ceb74ded2",
        "annotation_hash" : 55,
        "user" : "xgui",
        "fileID" : "B21_4826",
        "annotation" : {
            "path" : {
                "path" : [ 
                    "Path", 
                    {

                    }
                ],
                "name" : "Renamed 1"
            }
        },
    }


    before(()=>{
        db.db.get('users').drop()
        db.db.get('annotations').drop()
    })
    
    after(()=>{
        db.db.close()
    })

    const verifyJson = (returnedJson,original,done) => {
        const {_id, annotation_id, created_at,last_modified, ...rest} = returnedJson
        expect(_id).to.be.not.equal(undefined)
        expect(annotation_id).to.be.not.equal(undefined)
        expect(created_at).to.be.not.equal(undefined)
        expect(last_modified).to.be.not.equal(undefined)
        expect(last_modified).to.be.not.equal(null)
        expect(rest).to.be.deep.equal(original)
        done()
    }

    const catchFn = (e,expectErrorFlag,done) => {
        console.log(e)
        if(expectErrorFlag)
            expect(e).to.be.not.equal(null)
        else
            expect(e).to.be.equal(null)
        done()
    }

    describe('testing adding, and querying annotations',()=>{

        let id
        it('should insert annotations fine',(done)=>{
            db.updateAnnotation(Object.assign({},dummyAnnotation1,{created_at:Date.now().toString() } ))
                .then(json=>{
                    const {_id} = json
                    id = _id
                    verifyJson(json,dummyAnnotation1,done)
                })
                .catch(e=> catchFn(e,false,done))
        })

        it('should insert another annotaiton fine',(done)=>{

            db.updateAnnotation(Object.assign({},dummyAnnotation2,{created_at:Date.now().toString()}))
                .then(json=>verifyJson(json,dummyAnnotation2,done))
                .catch(e=>catchFn(e,false,done))
        })

        it('should query dummy annotation 1 fine',(done) => {
            db.findAnnotations({
                image_hash : dummyAnnotation1.image_hash
            })
                .then(json=>verifyJson(json[0],dummyAnnotation1,done))
                .catch(e=>catchFn(e,false,done))
        })

        it('should query dummy annotaiton 2 fine', done => {
            db.findAnnotations({
                image_hash : dummyAnnotation2.image_hash
            })
                .then(json => verifyJson(json[0],dummyAnnotation2,done))
                .catch(e=>catchFn(e,false,done))
        })

        it('should update the annotation fine',(done)=>{

            console.log({id,type: typeof id})

            db.updateAnnotation(
                Object.assign({}, dummyAnnotation1_edited, {annotation_id: id, created_at: Date.now().toString() })
            ).then(json=>{
                const { _id, created_at, last_modified, ...rest } = json
                expect(_id).to.be.not.equal(undefined)
                expect(created_at).to.be.not.equal(undefined)
                expect(rest).to.be.deep.equal( Object.assign({},dummyAnnotation1_edited,{ annotation_id : id }) )
                done()
            }).catch(done)
        })

        it('should contain both old and new annotations',(done)=>{

            db.db.get('annotations').find({
                annotation_id : id
            }).then(array=>{
                let numPackup = 0
                console.log(array)
                const importantFields = array.map(({ _id, created_at, backup,last_modified, ...rest })=>{
                    
                    if(backup) numPackup += 1
                    return rest
                })
                expect(numPackup).to.be.equal(1)
                const originalFields = [dummyAnnotation1,dummyAnnotation1_edited].map(item=>Object.assign({},item,{annotation_id:id}))
                importantFields.forEach(item=>{
                    const matchItem = originalFields.find(oItem=>oItem.annotation_hash===item.annotation_hash)
                    expect(matchItem).to.be.not.equal(undefined)
                    expect(matchItem).to.be.deep.equal(item)
                })

                done()
            }).catch(done)
        })

        it('should delete fine',(done)=>{
            db.deleteAnnotation({ annotation_id : id })
                .then(({_id,created_at,annotation_id,backup,last_modified,...rest})=>{
                    expect(backup).to.be.equal(true)
                    expect(rest).to.be.deep.equal(dummyAnnotation1_edited)
                    done()
                })
                .catch(done)
        })

        it('should undelete fine',(done)=>{
            db.undeleteAnnotation({ annotation_id : id})
                .then(json=>{
                    console.log(json)
                    return json
                })
                .then(({_id,created_at,annotation_id,backup,last_modified,...rest})=>{
                    expect(backup).to.be.equal(undefined)
                    expect(rest).to.be.deep.equal(dummyAnnotation1_edited)
                    done()
                })
                .catch(done)
        })

        it('dummy 2 should still be queryable',(done)=>{
            db.findAnnotations({
                image_hash : dummyAnnotation2.image_hash
            }).then(json=>{
                verifyJson(json[0],dummyAnnotation2,done)
            })
                .catch(e=>{
                    expect(e).to.be.equal(null)
                    done()
                })
        })
    })
})
