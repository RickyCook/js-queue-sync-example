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

// Wrapper to load, and parse request body in 1 promise
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

/* Delta updates
 *   The delta keeps the time in sync between client and server. Because we
 *   get the start time in server time, we need to convert that to client time
 *   for when to start the video. The delta simply tells us how many ms to add,
 *   or take away to keep sync
 */
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

/* Fetch videos
 *   Manages the queue for us. This will ensure that we always have a queue
 *   with `QUEUE_LENGTH` videos in it
 */
function handleFetchVideo(promise) {
    handleGenericAjax(promise)
        .then(function(json) {
            state.queue.push(json)
            console.log('Enqueued video', json)
            // Maybe start buffering here?

            if (state.queue.length < QUEUE_LENGTH) {
                // Not full; load more
                replenishQueue()
            } else {
                // Full queue; start playing
                ensurePlaying()
            }
        })
        .catch(function(err) { console.error('Error getting new vid', err) })
}

function replenishQueue() {
    // Fetch the next video after the last video that we have (or the next
    // after Jan 1st 1970; aka the head of the queue ;) )
    let lastTs = state.queue.length === 0 ? 0 : _.last(state.queue).start
    handleFetchVideo(fetch('/video?after=' + lastTs))
}

// Start replenishing right away
replenishQueue()

/* Play videos
 *   Get and remove the first video in the queue, trigger a queue
 *   replenishment to replace the video. New start time is the time
 *   the server told us +- the delta. Set timer to start the video at the
 *   correct time, and also queue the next video
 */
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
