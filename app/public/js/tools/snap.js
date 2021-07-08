var ToolSnap = {
  snap: (function () {
    const hippoDrawSrc = `https://unpkg.com/hippo-draw-box@0.0.3/index.js`
    const message = 'Draw a box to take a snap shot. ESC to cancel'
    let pr, downloadUrl, messagePr
    const onEscp = ev => {
      if (ev.key === 'Escape') {
        if (pr) window.hippoDrawBox.dismiss(pr)
        if (messagePr) window.hippoDrawBox.dismiss(messagePr)
      }
    }
    window.addEventListener('keydown', onEscp)
    return {
      click: function(prevTool) {

        if (!window.hippoDrawBox) {
          const srcEl = document.createElement('script')
          srcEl.src = hippoDrawSrc
          document.head.appendChild(srcEl)
        }
        new Promise((rs, rj) => {
          const intervalId = setInterval(() => {
            if (!!window.hippoDrawBox) {
              clearInterval(intervalId)
              rs()
            }
          }, 100)
        }).then(() => {
          pr = window.hippoDrawBox.getABox(message)
          const getBoxPr = pr.then(ev => {
            const { start, end } = ev
            const startPt = new OpenSeadragon.Point(start[0], start[1])
            const endPoint = new OpenSeadragon.Point(end[0], end[1])
            
            const fixedStartPt = Microdraw.viewer.viewport.viewportToImageCoordinates(
              Microdraw.viewer.viewport.pointFromPixel(startPt)
            )
            const fixedEndPt = Microdraw.viewer.viewport.viewportToImageCoordinates(
              Microdraw.viewer.viewport.pointFromPixel(endPoint)
            )

            pr = null

            return {
              fixedStartPt: { x: fixedStartPt.x, y: fixedStartPt.y },
              fixedEndPt: { x: fixedEndPt.x, y: fixedEndPt.y }
            }
          }).catch(() => {
            pr = null
          })

          getBoxPr.then(({ fixedStartPt, fixedEndPt }) => {
            if (messagePr) {
              console.error(`messagePr is already defined... terminating`)
              return
            }
            const { maxLevel } = Microdraw.viewer.source
            const tileWidth = Microdraw.viewer.source.getTileWidth()

            const x = Math.floor( Math.min(fixedStartPt.x, fixedEndPt.x) / tileWidth)
            const y = Math.floor( Math.min(fixedStartPt.y, fixedEndPt.y) / tileWidth)
            const x1 = Math.ceil( Math.max(fixedStartPt.x, fixedEndPt.x) / tileWidth)
            const y1 = Math.ceil( Math.max(fixedStartPt.y, fixedEndPt.y) / tileWidth)
            const size_x = x1 - x
            const size_y = y1 - y

            /**
             * TODO this is ugly, but... oh well
             */

            const url = Microdraw.viewer.source.getTileUrl(maxLevel,1,1,0)
            const getCropUrl = new URL(url)
            const s = getCropUrl.searchParams
            s.set('x', x)
            s.set('y', y)
            s.set('size_x', size_x)
            s.set('size_y', size_y)

            const messageDom = document.createElement('div')
            messagePr = hippoDrawBox.showMessage(messageDom)
            messagePr.then(() => messagePr = null).catch(() => messagePr = null)

            downloadUrl = getCropUrl.toString()
            const downloadBtn = document.createElement('a')
            downloadBtn.href = getCropUrl.toString()
            downloadBtn.target = '_blank'
            downloadBtn.download = 'hippo.png'
            downloadBtn.textContent = 'left click/right click -> save link as'
            messageDom.appendChild(downloadBtn)
            
          })
        })
      }
    }
  })()
}
