var _ = require('lodash')
var fetch = require('isomorphic-fetch')

var Promise = require('es6-promise').Promise

var DELTA_UPDATE_FREQ = 30000
var TRANSITIONS: [
    'http://t1',
    'http://t2',
    'http://t3'
]
var QUEUE_LENGTH = 2

var state = {
    playing: false,
    queue: []
}

function handleGenericAjax(promise) {
    var returnPromise = new Promise(function(resolve, reject) {
        promise.then(function(res) {
            if (!res.ok) {
                reject(res)
            }

            let contentType = res.headers.get('content-type')
            let bodyPromise = contentType.startsWith('application/json') ?
                res.json() : res.text()

            bodyPromise
                .catch(function(err) {
                    reject(err)
                })
                .then(function(data) {
                    resolve(data)
                })

        })
        .catch(function(err) {
            reject(err)
        })
    })
    return returnPromise
}

/* Delta updates */
function handleTimeUpdate(promise) {
    handleGenericAjax(promise)
        .then(function(text) {
            state.delta = Date.now() - parseInt(text)
            console.log('Delta updated to', state.delta)
        })
        .catch(function(err) { console.error('Error updating time delta', err) })
}

handleTimeUpdate(fetch('/time'))
setInterval(function() {
    handleTimeUpdate(fetch('/time'))
}, DELTA_UPDATE_FREQ)

/* Fetch videos */
function handleFetchVideo(promise) {
    handleGenericAjax(promise)
        .then(function(json) {
            state.queue.push(json)
            console.log('Enqueued video', json)
            // Maybe start buffering here?

            if (state.queue.length < QUEUE_LENGTH) {
                replenishQueue()
            } else {
                ensurePlaying()
            }
        })
        .catch(function(err) { console.error('Error getting new vid', err) })
}

function replenishQueue() {
    let lastTs = state.queue.length === 0 ? 0 : _.last(state.queue).start
    handleFetchVideo(fetch('/video?after=' + lastTs))
}

replenishQueue()

/* Play videos */
function uiPlayVideo(url) {
    console.log('Playing video', url)
}

function queueNext() {
    state.playing = true

    let video = state.queue.shift()
    let clientStart = video.start - state.delta
    let startIn = clientStart - Date.now()

    replenishQueue()

    console.log('Starting video', video.url, 'in', startIn, 'ms')

    setTimeout(function() {
        uiPlayVideo(video.url)
        queueNext()
    }, startIn)
}

function ensurePlaying() {
    if (state.playing) return
    queueNext()
}
