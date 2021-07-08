const url = require('url')
const sharp = require('sharp')
const request = require('request')
const crypto = require('crypto')
const path = require('path')
const fs = require('fs')
const { promisify } = require('util')
const asyncWrite = promisify(fs.writeFile)
const asyncUnlink = promisify(fs.unlink)
const LRU = require('lru-cache')
sharp.cache(false)

const lruStore = new LRU({
    maxAge: 1000 * 60 * 30, // 30min cache
    dispose: (key, value) => {
        try {
            asyncUnlink(value) // on key del, remove unused file
        } catch (e) {

        }
    }
})

module.exports = (app) =>{
    app.get('/getTile',function (req,res){
        const { source } = req.query

        if( !source )
            return res.status(404).send('source must be defined')

        request(req.query.source, {}).pipe(res)
    })

    app.get('/getJson',function (req,res) {
        const { source } = req.query;

        if( !source )
            return res.status(404).send('source must be defined')

        const thisHostname = req.protocol + '://' + req.get('host')
        const sourceHostname = 
            !source ? 
                null : 
                (new RegExp('^http')).test(source) ? 
                    url.parse(source).protocol + '//' + url.parse(source).host : 
                    req.protocol + '://' + req.hostname;
        const sourcePath = url.parse(source).path ? url.parse(source).path : null;
        (new Promise((resolve, reject)=>{
            if( sourceHostname && sourcePath ){
                request(sourceHostname + sourcePath, (err, resp, body) => {
                    if(err) reject(err)
                    if(resp && resp.statusCode >= 400)
                        reject(body)
                    else
                        resolve(body)
                })
            }else{
                reject('sourceurl not defined');
            }
        }))
            .then(body=>{
                const json = JSON.parse(body)
                json.tileSources = json.tileSources.map(tileSource=>
                    typeof tileSource !== 'string' ?
                        tileSource :
                        (new RegExp('^http')).test(tileSource) ? tileSource : tileSource[0] == '/' ? thisHostname + '/getTile?source=' + sourceHostname + tileSource : thisHostname + '/getTile?source=' + sourceHostname +  '/'+ tileSource );
                res.status(200).send(JSON.stringify(json));
            })  
            .catch(e=>{
                console.log('Error at /getJson',e)
                res.status(404).send(e);
            })
    })

    app.get('/getHighRes/:key', (req, res) => {
        return res.status(400).send('deprecated')
    })


    app.get('/getHighRes', async (req, res) => {
        return res.status(400).send('deprecated')
        
    })

}
