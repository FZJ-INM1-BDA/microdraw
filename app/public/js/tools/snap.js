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

            const messageDom = document.createElement('div')

            messagePr = hippoDrawBox.showMessage(messageDom)
            messagePr.then(() => messagePr = null).catch(() => messagePr = null)

            const search = new URLSearchParams()

            const jsonSrc = Microdraw.params.source
            const jsonSrcImgId = Microdraw.currentImage
            const outputType = 'png' // 'tiff' | 'png'
            const x = Math.min(fixedStartPt.x, fixedEndPt.x)
            const y = Math.min(fixedStartPt.y, fixedEndPt.y)
            const width = Math.abs(fixedEndPt.x - fixedStartPt.x)
            const height = Math.abs(fixedEndPt.y - fixedStartPt.y)

            search.set('jsonSrc', jsonSrc)
            search.set('jsonSrcImgId', jsonSrcImgId)
            search.set('outputType', outputType)
            search.set('x', x)
            search.set('y', y)
            search.set('width', width)
            search.set('height', height)

            const evSrc = new EventSource(`getHighResTest?${search.toString()}`)
            evSrc.onmessage = ev => {
              const data = ev.data
              if (/fin\:/.test(data)) {
                const match = /^fin\:(.+)$/.exec(data)
                downloadUrl = match[1]
                const downloadBtn = document.createElement('a')
                downloadBtn.href = downloadUrl
                downloadBtn.target = '_blank'
                downloadBtn.download = 'hippo.png'
                downloadBtn.textContent = 'save to local'
                messageDom.appendChild()
                evSrc.close()
              } else {
                messageDom.textContent = `Progress: ${data}%`
              }
            }
            evSrc.onerror = ev => {
              evSrc.close()
              console.error(`error!`, ev)
            }
            
          })
        })
      }
    }
  })()
}
