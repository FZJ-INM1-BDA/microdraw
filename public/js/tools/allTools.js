const fs = require('fs')

module.exports = new Promise((resolve,reject)=>{
    fs.readdir(__dirname,(err,files)=>{
        Promise.all(files
            .filter(file=>file!=='allTools.js')
            .map(file=>new Promise((rs,rj)=>{
                fs.readFile(__dirname + '/' + file,'utf-8',(err2,data)=>{
                    if(err2)rj(err2)
                    console.log(data)
                    rs(data.replace(/var.*?\=/,'ToolsAll[ToolsAll.length] = '))
                })
            })))
            .then(arr=>resolve('var ToolsAll = [];\n'+arr.join('\n')))
            .catch(e=>reject(e))
    })
})