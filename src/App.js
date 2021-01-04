import logo from "./logo.svg";
import "./App.css";
import React from "react";
import Plyr from "plyr";
import {url} from "./wsUrl"

const PC_CONFIG = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

let ignoreOffer = false;
let makingOffer = false;
let polite = false;
let srdAnswerPending = false;

class Main extends React.Component {
  constructor(props) {
    super(props);
    this.state = { ws: null };
  }

  componentDidMount() {
    this.connect();
  }

  timeout = 250;

  connect = () => {
    const ws = new WebSocket(url);
    const that = this;
    let connectInterval;

    ws.onopen = () => {
      console.log("Connected to websocket");
      this.setState({ ws: ws });
      that.timeout = 250;
      clearTimeout(connectInterval);
    };

    ws.onclose = (e) => {
      console.log(
        `Socket is closed. Reconnect will be attempted in ${Math.min(
          10000 / 1000,
          (that.timeout + that.timeout) / 1000
        )} second.`,
        e.reason
      );

      that.timeout = that.timeout + that.timeout;
      connectInterval = setTimeout(this.check, Math.min(10000, that.timeout));
    };

    // websocket onerror event listener
    ws.onerror = (err) => {
      console.error("Socket encountered error: ", err.message, "Closing socket");
      ws.close();
    };
  };

  check = () => {
    const { ws } = this.state;
    if (!ws || ws.readyState == WebSocket.CLOSED) this.connect(); //check if websocket instance is closed, if so call `connect` function.
  };

  render() {
    return <App websocket={this.state.ws}></App>;
  }
}

function App(props) {
  const pc = new RTCPeerConnection(PC_CONFIG);
  const log = (msg) => {
    document.getElementById("div").innerHTML += msg + "<br>";
  };

  pc.onconnectionstatechange = () => console.log(`peer connection ${pc.connectionState}`);
  pc.oniceconnectionstatechange = () => console.log(`ice connection state: ${pc.iceConnectionState}`);
  pc.onsignalingstatechange = () => console.log(`signaling state: ${pc.signalingState}`);

  pc.ontrack = (event) => {
    if (event.track.kind === "audio") {
      return;
    }
    const el = document.getElementById("player");
    el.srcObject = event.streams[0];
    el.autoplay = true;
    el.controls = true;
  };

  // pc.oniceconnectionstatechange = e => log(pc.iceConnectionState)
  // pc.onicecandidate = event => {
  //     if (event.candidate === null) {
  //         console.log(pc.localDescription);
  //         document.getElementById('localSessionDescription').value = btoa(JSON.stringify(pc.localDescription))
  //     }
  // }

  // Offer to receive 1 audio, and 1 video tracks
  pc.addTransceiver("audio", { direction: "recvonly" });
  // pc.addTransceiver('video', { 'direction': 'recvonly' })
  pc.addTransceiver("video", { direction: "recvonly" });

  const ws = props.websocket;
  pc.onicecandidate = (e) => {
    if (!e || !e.candidate) {
      console.log("Candidate null");
      console.log(e);
      return;
    }

    ws.send(JSON.stringify({ event: "candidate", data: JSON.stringify(e.candidate) }));
  };

  pc.onnegotiationneeded = async () => {
    try {
      makingOffer = true;
      await pc.setLocalDescription();
      const msg = { event: "offer", data: JSON.stringify(pc.localDescription) };
      ws.send(JSON.stringify(msg));
    }
    catch (e) {
      console.error(e);
    }
    finally {
      console.log('local description set');
      makingOffer = false;
    }
  };

  if (ws) {
    ws.onmessage = async function (evt) {
      let msg = JSON.parse(evt.data);
      if (!msg) {
        return console.log("failed to parse msg");
      }
      if (msg.event !== "candidate") {
        console.log(msg.event + " received");
        console.log(msg.data);
        const isStable = pc.signalingState === "stable" ||
                         pc.signalingState === "have-local-offer" && srdAnswerPending;
        const offerCollision = makingOffer || !isStable;
        ignoreOffer = !polite && offerCollision;
        if (ignoreOffer) return;
        srdAnswerPending = msg.event === "answer";
        await pc.setRemoteDescription(msg.data);
        srdAnswerPending = false;
        console.log("remote description set");
        if (msg.event === "offer") {
          await pc.setLocalDescription();
          console.log("local description set");
          const msg = { event: "answer", data: JSON.stringify(pc.localDescription) };
          ws.send(JSON.stringify(msg));
        }
      } else {
        const candidate = JSON.parse(msg.data);
        console.log(candidate);
        if (!candidate) {
          return console.log("failed to parse candidate");
        }
        try {
          await pc.addIceCandidate(candidate);
        } catch (e) {
          if (!ignoreOffer) throw e;
        }
      }
    };
  }

  // let sd = document.getElementById('remoteSessionDescription').value
  // if (sd === '') {
  //     return alert('Session Description must not be empty')
  // }

  // try {
  //     pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(atob(sd))))
  // } catch (e) {
  //     alert(e)
  //

  return (
    <div className="App">
      <header className="App-header">
        <div className="logo-header">
          <img id="logo-img" src="/images/lightspeedlogo.svg"></img>
          <h1>Project Lightspeed</h1>
        </div>
        <div></div>
      </header>
      <div className="container">
        <div className="video-container">
          <video
            id="player"
            playsInline
            controls
            poster="/images/img.jpg"
          ></video>
          <div className="video-details">
            <div className="detail-heading-box">
              <div className="detail-title">
                <span className="alpha-tag">
                  <div>
                    {" "}
                    <i class="fas fa-construction badge-icon"></i>Alpha
                  </div>
                </span>
                <h4 className="details-heading">
                  Welcome to Project Lightspeed - The future of live
                  entertainment
                </h4>
              </div>

              <img id="detail-img" src="/images/lightspeedlogo.svg"></img>
            </div>
          </div>
        </div>

        <div className="chat-container">
          <div className="chat-main">
            <div className="chat-heading chat-pad">
              <h6>Live Chat Room</h6>
              <i class="fas fa-long-arrow-up arrow"></i>
            </div>

            <div className="chat-body">
              <i class="fas fa-construction"></i>
              <h4>Coming Soon!</h4>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Main;
