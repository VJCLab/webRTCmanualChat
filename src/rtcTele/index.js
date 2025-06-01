import EventEmitter from "../event-emitter.js";

import FManager from "../fileManager/index.js";
const DEMOStunServers = [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun.l.google.com:5349" },
            { urls: "stun:stun1.l.google.com:3478" },
            { urls: "stun:stun1.l.google.com:5349" },
            { urls: "stun:stun2.l.google.com:19302" },
            { urls: "stun:stun2.l.google.com:5349" },
            { urls: "stun:stun3.l.google.com:3478" },
            { urls: "stun:stun3.l.google.com:5349" },
            { urls: "stun:stun4.l.google.com:19302" },
            { urls: "stun:stun4.l.google.com:5349" }
        ]
class RTCTele extends EventEmitter {
    constructor({
        onSystemMsg = () => { }
    }) {
        super();
        const p = this.PEERCONNECTION = new RTCPeerConnection({
            iceServers: DEMOStunServers
        });
        this.ICES = [];
        this.fileManager = new FManager();
        this.fileManager.initialize(this);
        this.loggedIn = false;
        this.on("systemMsg", onSystemMsg);
        this.on("iceCandidate", e => {
            this.ICES.push(e);
            //p.addIceCandidate(e)
        });
        this.on("onChannelOpen", () => {
            this.loggedIn = true;
        });
        this.on("createdChannel", channel => {
            if (!channel) return;
            this._setupDataChannel(channel);
        });
        this.on("setRemoteDesc", d => {
            p.setRemoteDescription(d);
            this.emit("systemMsg", "📥 상대방 설명 적용 완료");
        });
        this.on("requestReflashICE", () => this.emit("reflashICE", this.ICES));
        this.on("requestAddRemoteIce", ICES => this.addRemoteIce(ICES));
        this.on("fileData", (meta, e) => this.handleFileTransfer(meta, e));

        // might be toggled when non offer.
        p.addEventListener("icecandidate", e => {
            if (e.candidate) this.emit("iceCandidate", e.candidate);
        });
        p.addEventListener("datachannel", e => this.emit("createdChannel", e.channel));

        this.emit("systemMsg", `🔧 로그인 준비 완료`);
    }
    _setupDataChannel(channel) {
        const label = channel.label;

        if (label === "chat") {
            this.MSGCHANNEL = channel; // 주 채널로 저장 (optional)
            this.fileManager.META.listen(channel, e => this.emit("chatMessage", e));
            channel.addEventListener("open", () => this.emit("onChannelOpen"));
            this.emit("systemMsg", `💬 채팅 채널 준비됨`);
        } else if (label === "fileTransfer") {
            // RTCDataChannel
            // this.FILECHANNEL = channel;
            this.fileManager.FILECHANNEL = channel;
            this.fileManager.listen(channel);


            channel.addEventListener("open", () => {
                this.emit("systemMsg", `📁 파일 채널 준비됨`);
            });
        } else {
            this.emit("systemMsg", `❓ 알 수 없는 채널: ${label}`);
        }
    }

    createOffer() {
        const pc = this.PEERCONNECTION;
        if (!pc) return;
        // 🟢 1. 두 개의 채널 생성
        const chatChannel = pc.createDataChannel("chat");
        const fileChannel = pc.createDataChannel("fileTransfer");

        // 🟢 2. 이벤트 등록
        this._setupDataChannel(chatChannel);
        this._setupDataChannel(fileChannel);

        // 🟢 3. Offer 생성
        pc.createOffer().then((offer) => {
            pc.setLocalDescription(offer);
            this.emit("createdOffer", offer);
            this.emit("systemMsg", `📤 Offer 생성됨`);
        });


    }
    createAnswer() {
        const pc = this.PEERCONNECTION;
        if (!pc) return;

        pc.createAnswer().then((answer) => {
            pc.setLocalDescription(answer);
            this.emit("createdAnswer", answer);
            this.emit("systemMsg", `Answer 생성됨 (복사해서 상대에게 전달)`);
        });
    }
    addRemoteIce(ICES) {
        if (!this.PEERCONNECTION || !ICES || !Array.isArray(ICES)) return;

        ICES.forEach((c) => {
            this.PEERCONNECTION.addIceCandidate(new RTCIceCandidate(c));
        });
        this.emit("systemMsg", "📥 상대 ICE 후보 적용 완료");
    }
    static RemoteDescEmptyError = class extends Error {
        constructor(message, isOffer) {
            super(message);
            this.name = "RemoteDescEmptyError";
            this.isOffer = isOffer;
        }
    }
    /**
     * Offer/Answer 생성을 위해 2개의 textarea elm (offer, answer)에서
     * remote description을 생성하여 반환.
     * @param {HTMLTextAreaElement} offerRemoteDescElm  offer remote description textarea elm
     * @param {HTMLTextAreaElement} answerRemoteDescElm answer remote description textarea elm
     * @param {HTMLButtonElement[]} remoteSideTabsLIElems  remote side tabs button elements
     * @returns {RTCSessionDescription} remote description
     */
    static genRemoteDescription(offerRemoteDescElm, answerRemoteDescElm, answerGenBtn, remoteSideTabsLIElems = []) {
        if (!offerRemoteDescElm instanceof HTMLTextAreaElement || !answerRemoteDescElm instanceof HTMLTextAreaElement) return;
        if (answerGenBtn) answerGenBtn.disabled = true;
        let a = offerRemoteDescElm.value;
        const isOffer = remoteSideTabsLIElems[0]?.classList.contains('active');
        if (!isOffer) {
            a = answerRemoteDescElm.value;
        }
        [offerRemoteDescElm, answerRemoteDescElm].forEach(e => e.classList.remove("is-invalid"));
        if (!a || a === "") {
            // throw new RTCTele.RemoteDescEmptyError("remote description is empty", isOffer);

            if (isOffer) {
                offerRemoteDescElm.classList.add("is-invalid");
            } else
                answerRemoteDescElm.classList.add("is-invalid");

            throw new RTCTele.RemoteDescEmptyError(`상대방 설명이 비었습니다. 다시 입력해 주세요.`)
        }
        const remoteDesc = new RTCSessionDescription(JSON.parse(a));

        answerGenBtn.disabled = false;
        return remoteDesc;
    }
    sendMsg(msg) {
        if (!this.MSGCHANNEL || !msg || this.MSGCHANNEL.readyState !== "open") return;
        this.MSGCHANNEL.send(msg);
    }

    /** @type {?RTCPeerConnection} */
    PEERCONNECTION = null;
    /** @type {?RTCIceCandidate[]} */
    ICES = [];
    /** @type {boolean} login status.*/
    loggedIn = false;
    /** @type {?RTCDataChannel} */
    MSGCHANNEL = null;
    /** @type {?string} 전송측 유저 ID */
    LOCALUSERID = null;
    /** @type {?string} 전송측 상대 유저 ID */
    REMOTEUSERID = null;
}

export default RTCTele;