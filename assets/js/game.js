"use strict";

import {Song} from "./ultrastar/parser";
import {GameDisplay} from "./display";
import {LocalPlayer, RemotePlayer} from "./player";
let EventEmitter = require("events");

export class GameSession extends EventEmitter {
    constructor(container, width, height, songURL) {
        super();
        this.container = container;
        this.width = width;
        this.height = height;
        this.songURL = songURL;
        this.audio = null;
        this.display = null;
        this.players = [];

        this.song = null;
        this._startTime = null;
        this._ready = false;
        this._ac = new (window.AudioContext || window.webkitAudioContext)();
    }

    setSize(width, height) {
        this.width = width;
        this.height = height;
        if (this.display) {
            this.display.setSize(width, height);
        }
    }

    prepare() {
        fetch(this.songURL)
            .then((response) => response.text())
            .catch((e) => this.emit("error", e))
            .then((text) => this._prepare(text))
    }

    start() {
        this.display.createGameLayout();
        this.display.title().then(() => {
            if (this.ready) {
                this._startTime = this._ac.currentTime;
                this.audio.start();
                this._startedPlaying();
            } else {
                throw new Error("Not ready yet.");
            }
        });
    }

    cleanup() {
        this.display.stop();
        this.container.innerHTML = '';
    }

    addPlayer(player) {
        this.players.push(player);
    }

    _prepare(songText) {
        this.song = new Song(this._baseURL, songText);

        this.audio = this._ac.createBufferSource();
        this.audio.connect(this._ac.destination);
        this.audio.addEventListener('ended', () => this._stoppedPlaying());
        this._fetchAudio();

        this.display = new GameDisplay(this.container, this.width, this.height, this.song, this.players, this);
        this.display.on('ready', () => this._maybeReady());
        this.display.prepareVideo();
    }

    _fetchAudio() {
        fetch(this.song.mp3)
            .then((x) => x.arrayBuffer())
            .then((buffer) => this._ac.decodeAudioData(buffer))
            .then((buffer) => { this.audio.buffer = buffer; this._maybeReady(); })
            .catch((e) => console.error("Failed", e));
    }

    _maybeReady() {
        console.log('maybeReady', this.audio.buffered, this.display.ready);
        if (this.audio.buffer) {
            console.log(`Audio ready.`);
            if (this.display.ready) {
                this._definitelyReady();
            }
        }
    }

    _startedPlaying() {
        this.display.start();
        for (let player of this.players) {
            player.start();
        }
    }

    _stoppedPlaying() {
        this.display.stop();
        for (let player of this.players) {
            player.stop();
        }
        this.emit("finished");
    }

    _definitelyReady() {
        console.log('definitelyReady');
        this._ready = true;
        this.emit('ready');
    }

    get localPlayer() {
        for (let player of this.players) {
            if (player instanceof LocalPlayer) {
                return player;
            }
        }
        return null;
    }

    get currentTime() {
        if (this._startTime === null) {
            return 0;
        }
        return this._ac.currentTime - this._startTime;
    }

    get _baseURL() {
        return this.songURL.split('/').slice(0, -1).join('/');
    }

    get ready() {
        return this._ready;
    }
}
