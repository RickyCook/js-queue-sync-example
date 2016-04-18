var _ = require('lodash')
var express = require('express')
var webpack = require('webpack')

var Promise = require('es6-promise').Promise

var config = require('./webpack.config.js')

var app = express()
var compiler = webpack(config)

var FIRST_DELAY = 5000
var TRANSITION_DELAY = 400
var QUEUE_LENGTH = 5

var state = {
    queue: {},
    queueTimes: []
}

app.use(express.static('.'))

app.use(require('webpack-dev-middleware')(compiler, {
    noInfo: true,
    publicPath: config.output.publicPath
}))
app.use(require('webpack-hot-middleware')(compiler))

function videoDuration(url) {
    return new Promise(function(resolve, reject) {
        resolve(Math.floor(Math.random() * 5000) + 5000)
    })
}
function videoUrl() {
    return new Promise(function(resolve, reject) {
        resolve('http://videourl/' + Date.now())
    })
}
function removeOldVideos() {
    var timeNow = Date.now()

    // Index where videos are older than current time
    var oldIdx = _.findIndex(state.queueTimes, function(timestamp) {
        return timestamp < timeNow
    })

    // Split queue array into old, and new videos
    var oldVideos = state.queueTimes.slice(0, oldIdx + 1)
    state.queueTimes = state.queueTimes.slice(oldIdx + 1)

    console.log('Removing', oldVideos.length, 'videos')

    // Remove old videos from queue obj
    _.each(oldVideos, function(timestamp) {
        delete state.queue[timestamp]
    })
}
function replenishQueue() {
    return new Promise(function(allResolve, allReject) {
        var toReplenish = QUEUE_LENGTH - state.queueTimes.length
        console.log('Replenishing', toReplenish, 'videos')

        // Create array of n promises, where n is number of videos needed
        var promises = _.times(toReplenish, function() {
            return new Promise(function(thisResolve, thisReject) {

                // Get new video, then find duration
                videoUrl().then(function(url) {
                    videoDuration(url).then(function(duration) {
                        var isFirst = state.queueTimes.length === 0

                        var lastStartTime = isFirst ?
                            null : _.last(state.queueTimes)

                        var thisStartTime = isFirst ?
                            Date.now() + FIRST_DELAY :
                            (
                                lastStartTime +
                                state.queue[lastStartTime].duration +
                                TRANSITION_DELAY
                            )

                        state.queueTimes.push(thisStartTime)
                        state.queue[thisStartTime] = {
                            url: url,
                            duration: duration,
                            start: thisStartTime
                        }

                        console.log('Added video', state.queue[thisStartTime])
                        thisResolve(state.queue[thisStartTime])
                    })
                })
            })
        })

        // Wait for queue to be full
        Promise.all(promises).then(function(){ allResolve() })
    })
}
function nextQueueKeeping() {
    // Run queue keeping after the start time of first video in queue
    var waitTime = _.first(state.queueTimes) - Date.now()
    setTimeout(queueKeeping, waitTime)
}
function queueKeeping() {
    removeOldVideos()
    replenishQueue()
        .then(function() { nextQueueKeeping() })
}

app.get('/time', function(req, res) {
    res.send(Date.now().toString())
})
app.get('/video', function(req, res) {
    var after = parseInt(req.query.after)
    var nextTs = _.find(state.queueTimes, function(timestamp) {
        return timestamp > after
    })
    res.send(state.queue[nextTs])
})

app.listen(4000, function() {
    console.log('Listening on 4000')
})

queueKeeping()
