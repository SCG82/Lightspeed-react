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
    this.pc = null;
    this.handlePcChange = this.handlePcChange.bind(this);
    this.state = { ws: null, pc: null };
  }

  componentDidMount() {
    this.connect();
  }

  handlePcChange() {
    this.setState({ pc: this.pc });
  }

  timeout = 250;

  connect = () => {
    const ws = new WebSocket(url);
    const that = this;
    let connectInterval;

    ws.onopen = () => {
      that.setState ({ ws: ws });
      console.log("Connected to websocket");
      that.timeout = 250;
      clearTimeout(connectInterval);
      const pc = new RTCPeerConnection(PC_CONFIG);
      that.setState({ pc: pc });
      pc.onconnectionstatechange = () => console.log(`peer connection ${pc.connectionState}`);
      pc.oniceconnectionstatechange = () => console.log(`ice connection state: ${pc.iceConnectionState}`);
      pc.onsignalingstatechange = () => console.log(`signaling state: ${pc.signalingState}`);
      pc.onicecandidate = (e) => {
        that.setState({ pc: pc });
        if (!e || !e.candidate) {
          console.log("Candidate null");
          console.log(e);
          return;
        }
        const msg = JSON.stringify({ event: "candidate", data: JSON.stringify(e.candidate) });
        ws.send(msg);
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
          console.log("local description set");
          makingOffer = false;
        }
      };
    };

    ws.onmessage = async function (evt) {
      if (!that.state.pc) return;
      let msg = JSON.parse(evt.data);
      if (!msg) {
        return console.log("failed to parse msg");
      }
      if (msg.event !== "candidate") {
        console.log(msg.event + " received");
        console.log(msg.data);
        const isStable = that.state.pc.signalingState === "stable" ||
                         that.state.pc.signalingState === "have-local-offer" && srdAnswerPending;
        const offerCollision = makingOffer || !isStable;
        ignoreOffer = !polite && offerCollision;
        if (ignoreOffer) return;
        srdAnswerPending = msg.event === "answer";
        await that.state.pc.setRemoteDescription(msg.data);
        srdAnswerPending = false;
        console.log("remote description set");
        if (msg.event === "offer") {
          await that.state.pc.setLocalDescription();
          console.log("local description set");
          const msg = { event: "answer", data: JSON.stringify(that.state.pc.localDescription) };
          ws.send(JSON.stringify(msg));
        }
      } else {
        const candidate = JSON.parse(msg.data);
        console.log(candidate);
        if (!candidate) {
          return console.log("failed to parse candidate");
        }
        try {
          await that.state.pc.addIceCandidate(candidate);
        } catch (e) {
          if (!ignoreOffer) throw e;
        }
      }
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
    return (
      <App
        peerconnection={this.state.pc}
      />
    );
  }
}

function App(props) {
  //let ignoreOffer = false;
  //let makingOffer = false;
  //let polite = false;
  //let srdAnswerPending = false;
  //const ws = props.websocket;

  //const pc = new RTCPeerConnection(PC_CONFIG);
  const peerconnection = props.pc;
  const log = (msg) => {
    document.getElementById("div").innerHTML += msg + "<br>";
  };

  //pc.onconnectionstatechange = () => console.log(`peer connection ${pc.connectionState}`);
  //pc.oniceconnectionstatechange = () => console.log(`ice connection state: ${pc.iceConnectionState}`);
  //pc.onsignalingstatechange = () => console.log(`signaling state: ${pc.signalingState}`);

  if (peerconnection) {
  peerconnection.ontrack = (event) => {
    if (event.track.kind === "audio") {
      return;
    }
    const el = document.getElementById("player");
    el.srcObject = event.streams[0];
    el.autoplay = true;
    el.controls = true;
  };
  }

  // pc.oniceconnectionstatechange = e => log(pc.iceConnectionState)
  // pc.onicecandidate = event => {
  //     if (event.candidate === null) {
  //         console.log(pc.localDescription);
  //         document.getElementById('localSessionDescription').value = btoa(JSON.stringify(pc.localDescription))
  //     }
  // }

  if (peerconnection) {
  // Offer to receive 1 audio, and 1 video tracks
  peerconnection.current.addTransceiver("audio", { direction: "recvonly" });
  // pc.addTransceiver('video', { 'direction': 'recvonly' })
  peerconnection.current.addTransceiver("video", { direction: "recvonly" });
  }

  /*
  pc.onicecandidate = (e) => {
    if (!e || !e.candidate) {
      console.log("Candidate null");
      console.log(e);
      return;
    }
    const msg = JSON.stringify({ event: "candidate", data: JSON.stringify(e.candidate) });
    ws.send(msg);
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
      console.log("local description set");
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
  */

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
