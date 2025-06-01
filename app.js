import EventEmitter from "./src/event-emitter.js";
import RTCTele from "./src/rtcTele/index.js";
class APP extends EventEmitter {
    constructor() {
        super();
        this.PERFORMANCES.ploadStart = performance.now();

        this.on("pageLoad", this.pageLoad.bind(this));

        new Promise(r => window.onload = () => r(1)).then(() => this.emit("pageLoad"));
        window.APP = this;

    }
    fileUploadInput = null;
    chatForm = null;
    chatBody = null;
    settingModal = null;
    loggedIn = false;
    PERFORMANCES = {
        ploadStart: null,
        ploadEnd: null,
        ploadDiff: null
    };
    TEMPLATES = {
        sender: "#temp-msg-sender",
        receiver: "#temp-msg-receiver",
        system: "#temp-msg-system"
    };

    /** @type {?RTCTele} */
    TELE = null;
    sendMsg(e) {
        e.preventDefault();
        //const msg = this.chatForm.chatInput.value;
        //if (!msg) return;
        const msgElm = this.chatForm.chatInput;
        const fileElm = this.chatForm.fileUploadInput;
        const msg = msgElm.value?.trim();
        const files = fileElm.files;
        const senderID = this.TELE.LOCALUSERID;
        if (msg) {
            this.chatSystemMsg(`나: ${msg}`);
            const form = {
                senderID,
                msg
            }
            this.TELE.sendMsg(JSON.stringify(form));

            msgElm.value = "";
        }
        if (files.length) {
            // 파일 전송
            this.TELE.fileManager.sendFile(files, () => { }, () => {
                fileElm.value = ""; // input 초기화
            });

        }
    }
    chatSystemMsg(msg, showTimeStamp = true) {
        if (!msg || !this.chatBody || !this.TEMPLATES.system instanceof HTMLTemplateElement) return;
        const e = this.TEMPLATES.system.querySelector("div").cloneNode(true);
        if (showTimeStamp) msg = `[${new Date().toLocaleString()}] ${msg}`;
        e.querySelector("p").innerHTML = msg;
        // 롱클릭 이벤트 처리
        this.addChatDeleteHandler(e);
        this.chatBody.appendChild(e);
    }

    // 롱클릭 핸들러 추가 메서드
    addChatDeleteHandler(element) {
        let longClickTimer;
        let isLongClick = false;
        const deleteBtn = element.querySelector('.chat-delete-btn');
        // 터치/마우스 시작
        const startLongClick = () => {
            isLongClick = false;
            longClickTimer = setTimeout(() => {
                isLongClick = true;
                deleteBtn.style.display = 'flex';
            }, 800); // 800ms 롱클릭
        };

        // 터치/마우스 종료
        const endLongClick = () => {
            clearTimeout(longClickTimer);
        };

        // 삭제 버튼 클릭 처리
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            element.remove();
        });

        // 다른 곳 클릭시 삭제 버튼 숨기기
        document.addEventListener('click', (e) => {
            if (!element.contains(e.target)) {
                deleteBtn.style.display = 'none';
            }
        });

        // 터치 이벤트 (모바일)
        element.addEventListener('touchstart', startLongClick, { passive: true });
        element.addEventListener('touchend', endLongClick, { passive: true });
        element.addEventListener('touchcancel', endLongClick, { passive: true });

        // 마우스 이벤트 (데스크톱)
        element.addEventListener('mousedown', startLongClick, { passive: true });
        element.addEventListener('mouseup', endLongClick, { passive: true });
        element.addEventListener('mouseleave', endLongClick, { passive: true });
    }
    updateStatus(open) {
        const label = document.getElementById("statusLabel");
        label.classList.remove("bg-success", "bg-secondary");
        if (open) {
            label.classList.add("bg-success");
            label.innerText = "🔓 채널 상태: 열림";
        } else {
            label.classList.add("bg-secondary");
            label.innerText = "🔒 채널 상태: 연결되지 않음";
        }
    }
    async pageLoad() {
        const f = this.chatForm = document.querySelector("form.chat-senderOptions");
        this.chatBody = document.querySelector(".chat-section .card-body");
        const fileUploadInput = document.getElementById("fileUploadInput");
        const fileUploadToggle = document.getElementById("fileUploadToggle");
        fileUploadToggle.addEventListener("click", () => {
            const d = fileUploadInput.style.display == "block";
            fileUploadInput.style.display = !d ? "block" : "none";
        });

        this.on("submitMsg", this.sendMsg.bind(this));
        this.on("loadSuccess", diffms => {
            this.chatSystemMsg(`페이지 로딩이 완료됬습니다. (${diffms} 소요됨.)`);
            this.updateStatus(false);
            document.querySelector(".loginWarnOverlay").classList.toggle("show");
            this.initTele();
        });
        this.on("loginSuccess", () => {
            this.chatSystemMsg(`데이터 채널 열림`);
            //details element
            //document.getElementById("iceSettings").removeAttribute("open");

            // close modal.
            document.querySelector("#rtcLogin-modal button.btn-close").dispatchEvent(new Event("click"));

            document.querySelector(".loginWarnOverlay").classList.remove("show");
            this.updateStatus(true);
        })
        f.addEventListener("submit", e => this.emit("submitMsg", e));
        Object.entries(this.TEMPLATES).forEach(([k, v]) => {
            const t = document.querySelector(v);
            this.TEMPLATES[k] = t.cloneNode(true).content;
        });
        await fetch("./modals/loginModal.html").then(r => r.text()).then(t => {
            document.body.insertAdjacentHTML("beforeend", t);

        });
        document.addEventListener('hidden.bs.modal', function () {
            if (document.activeElement) {
                document.activeElement.blur();
            }
        });
        document.getElementById("rtcLogin-modal").addEventListener("hide.bs.modal", () => {
            const id = document.getElementById("loginID-modal").value || null;
            this.TELE.LOCALUSERID = id;
            document.getElementById("loginID-config").value = id ?? "";
        });
        this.fileUploadInput = fileUploadInput;

        this.PERFORMANCES.ploadEnd = performance.now();
        const diff = this.PERFORMANCES.ploadDiff = `${(this.PERFORMANCES.ploadEnd - this.PERFORMANCES.ploadStart).toFixed(2)}ms`;
        // emit load success.
        this.emit("loadSuccess", diff);
    }
    remoteDescValidtion() {
        const remoteDescOffer = document.getElementById("remoteDescOffer");
        const remoteDescAnswer = document.getElementById("remoteDescAnswer");
        try {
            let remoteDesc = RTCTele.genRemoteDescription(
                remoteDescOffer,
                remoteDescAnswer,
                document.getElementById("createAnswer"),
                document.querySelectorAll("#selectRemoteSideTabs li button")
            );
            this.TELE.emit("setRemoteDesc", remoteDesc);
        } catch (e) {
            if (e instanceof RTCTele.RemoteDescEmptyError) {
                this.emit("systemMsg", e.message);
            } else {
                throw e;
            }
        }

    }
    remoteIceValidtion() {
        const ri = document.getElementById("remoteIce");
        ri.classList.remove("is-invalid");
        const v = ri.value;
        if (ri.value == "") {
            ri.classList.add("is-invalid");
            this.chatSystemMsg(`ICE 채널이 비었습니다. 다시 입력해 주세요.`);
            return;
        };
        this.TELE.emit("requestAddRemoteIce", JSON.parse(v));
    }
    initTele() {
        const t = this.TELE = new RTCTele({
            onSystemMsg: this.chatSystemMsg.bind(this)
        });
        t.on("createdOffer", offer => {
            document.getElementById("offer").value = JSON.stringify(
                offer,
                null,
                2
            );
        });
        t.on("createdAnswer", answer => {
            document.getElementById("answer").value = JSON.stringify(
                answer,
                null,
                2
            );
        });
        t.on("reflashICE", (ices = []) => {
            let d = document.getElementById("localIce");
            d.classList.remove("is-invalid");
            if (!ices.length) { d.classList.add("is-invalid"); return; }
            d.value = JSON.stringify(ices, null, 2)
        })
        t.on("onChannelOpen", () => this.emit("loginSuccess"));

        t.on("chatMessage", ev => {
            if (!ev.data) return;
            let d = JSON.parse(ev.data);
            const { senderID = "상대", msg } = d;
            this.chatSystemMsg(`${senderID}: ${msg}`);
        })
        t.on("fileDownloadReady", ({ fileName, downloadUrl, fileIndex, totalFiles }) => {
            const a = document.createElement("a");
            a.href = downloadUrl;
            a.download = fileName;
            a.innerText = fileName;
            // a.click();
            this.chatSystemMsg(`<span>파일 다운로드 (${fileIndex + 1}/${totalFiles})</span><br>${a.outerHTML}`);
        })
        document.getElementById("createOffer").addEventListener("click", () => this.TELE.createOffer());
        document.getElementById("createAnswer").addEventListener("click", () => this.TELE.createAnswer());
        document.querySelectorAll("#setRemoteDescription")
            .forEach(el => el.addEventListener("click", this.remoteDescValidtion.bind(this)));
        document.getElementById("reflashICE").addEventListener("click", () => this.TELE.emit("requestReflashICE"));
        document.getElementById("addRemoteIce").addEventListener("click", () => this.remoteIceValidtion());
    }
}
export default APP;