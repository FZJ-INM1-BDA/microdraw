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
        const { key } = req.params
        const filename = lruStore.get(key)
        if (!filename) return res.status(404).end()

        res.sendFile(filename)
        res.on('finish', () => {
            lruStore.del(key) // file will get unlinked on dispose of lru key
        })
    })


    app.get('/getHighRes', async (req, res) => {
        console.log(`[getHighRes] called`)
        const { x, y, width, height, level, jsonSrc, jsonSrcImgId } = req.query || {}
        console.log(`[getHighRes] param: \n ${JSON.stringify({x, y, width, height, level, jsonSrc, jsonSrcImgId}, null, 2)}`)
        for (const val of [x, y, width, height, jsonSrc, jsonSrcImgId] ) {
            if (val === null || typeof val === 'undefined') {
                return res.status(400).send(`param missing`)
            }
        }

        const u = new url.URL(jsonSrc)
        // hard coding trusted json src
        if ( u.host !== 'imedv02.ime.kfa-juelich.de:5555') {
            return res.status(400).send(`jsonSrc has to be from a trusted source`)
        }

        const { tileSources, imagesMetadata, names } = await new Promise((rs, rj) => {
            console.log(`[getHighRes] getting json src from ${u.toString()}`)
            request(u.toString(), { encoding: null }, (err, resp, body) => {
                if (err) return rj(err)
                if (resp.statusCode >= 400) {
                    return rj(`json server returns error: ${resp.statusCode}`)
                }
                rs(JSON.parse(body))
            })
        })

        console.log(`[getHighRes] got json src from ${u.toString()}`)

        const idx = names.findIndex(name => name === jsonSrcImgId)
        if (idx < 0) {
            return res.status(400).send(`cannot find ${jsonSrcImgId} in json`)
        }
        const source = tileSources[idx]

        /**
         * level is optional
         * x, y, width, height should always be relative to max level
         */

        const { width: iWidth, height: iHeight, getTileUrl, tileSize } = source

        const maxLevel = Math.ceil(
            Math.log(Math.max(iWidth, iHeight)) / Math.log(2)
        )
        const getLevel = level || maxLevel
        if (getLevel > maxLevel) {
            res.status(400).send(`level exceeds max level`)
            return
        }

        const filename = crypto.createHash('md5').update(Date.now().toString()).digest('hex')
        const outputTmpFilename = `${filename}.tif`
        const outputFilepath = path.join(__dirname, outputTmpFilename)

        const factor = Math.pow(2, maxLevel - getLevel) 

        let getTileFn
        eval(`getTileFn = ${getTileUrl}`)
        const xStart = Math.floor(Number(x) / factor / tileSize)
        const xEnd = Math.ceil( (Number(x) + Number(width)) / factor / tileSize )
        const yStart = Math.floor( Number(y) / factor / tileSize )
        const yEnd = Math.ceil( (Number(y) + Number(height)) / factor / tileSize )

        /**
         * send response header
         */
        res.setHeader('Cache-control', 'no-cache')
        res.setHeader('Content-type', 'text/event-stream')
        res.setHeader('Connection', 'keep-alive')
        res.flushHeaders()

        const totalTileNo = (xEnd - xStart ) * (yEnd - yStart )
        let progress = 0, completeFlag = false, closedFlag = false

        /**
         * if sse prematurely ends, remove file
         */
        res.on('close', () => {
            closedFlag = true
            if (!completeFlag) {
                asyncUnlink(outputFilepath)
            }
        })

        console.log(`[getHighRes] preparing sharp new image`)

        /**
         * tiff options seems to cause more issues than otherwise
         * do not use for now.
         * 
         * for a complete list of options:
         * https://sharp.pixelplumbing.com/api-output#tiff
         */
        const tiffOptions = {
            // tile: true,
            // tileWidth: tileSize,
            // tileHeight: tileSize,
            // compression: 'none',
            // predictor: 'float'
        }

        const buf = await sharp({
            create: {
                width: (xEnd - xStart) * tileSize,
                height: (yEnd - yStart) * tileSize,
                channels: 4,
                background: { r: 0, g: 0, b: 0, alpha: 1.0 }
            }
        }).tiff(tiffOptions).toBuffer()

        await asyncWrite(outputFilepath, buf)

        try {

            // going to try to hold all tiles in memory
            // for larger number of tiles, this can possibly lead to OOM
            // if that's the case, try write to disk, but set sharp.cache(false) at global
            // also try using tiff, which may have some advantages (?)
            for (let i = xStart; i < xEnd; i ++) {
                for (let j = yStart; j < yEnd; j++) {
                    await new Promise((rs, rj) => {
                        const url = getTileFn(getLevel, i, j, 0)
                        request.get({ url, encoding: null }, async (err, resp, body) => {
    
                            if (closedFlag) return rj('request has already been closed')
                            if (err) return rj(err)
                            try {

                                const inputBuf = await sharp(body).tiff(tiffOptions).toBuffer()
    
                                const buf2 = await sharp(outputFilepath)
                                    .composite([{
                                        input: inputBuf,
                                        left: (i - xStart) * tileSize,
                                        top: (j - yStart) * tileSize,
                                    }]).tiff(tiffOptions).toBuffer()
                                
                                await asyncWrite(outputFilepath, buf2)
                            } catch (e) {
                                console.log(e)
                                rj(e)
                            }
    
                            progress ++
                            console.log(`[getHighRes] got image tile at ${i}, ${j}, progress ${progress / totalTileNo}`)
                            res.write(`data: ${Math.round(progress / totalTileNo * 100)}\n\n`)
                            rs()
                        })
                    })
                }
            }

            completeFlag = true
            const key = crypto.createHash('md5').update(Date.now().toString()).digest('hex')
            lruStore.set(key, outputFilepath)
            res.write(`data: fin: getHighRes/${key}\n\n`)
            res.end()
            
        } catch (e) {
            console.error(`error in compositing image`, e)
            res.write(`data: err: ${e.toString()}\n\n`)
            res.end()
        }
        
    })

}
