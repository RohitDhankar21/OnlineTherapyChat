let APP_ID = "8284ac0a77884b77810cc459cd5194c9";
let token = null;
let uid = String(Math.floor(Math.random() * 10000));
let client;
let channel;
let localStream;
let remoteStream;
let peerConnection;

const servers = {
    iceServers: [
        {
            urls: ["STUN:freeturn.net:3478"]
        }
    ]
};

const audioConstraints = {
    echoCancellation: true,
    noiseSuppression: true,
    sampleRate: 44100
};

let constraints = {
    video: {
        width: { min: 640, ideal: 1920, max: 1920 },
        height: { min: 480, ideal: 1080, max: 1080 }
    },
    audio: audioConstraints
};

let init = async () => {
    // Check if a room name is present in the URL
    const queryString = window.location.search;
    const urlParams = new URLSearchParams(queryString);
    const roomId = urlParams.get('room');

    if (!roomId) {
        console.error("No room name provided in the URL.");
        return;
    }

    // Create an instance of AgoraRTM client
    client = await AgoraRTM.createInstance(APP_ID);
    await client.login({ uid, token });

    // Join the channel corresponding to the room
    channel = client.createChannel(roomId);
    await channel.join();

    // Set up event listeners
    channel.on('MemberJoined', handleUserJoined);
    channel.on('MemberLeft', handleUserLeft);
    client.on('MessageFromPeer', handleMessageFromPeer);

    // Get local media stream
    localStream = await navigator.mediaDevices.getUserMedia(constraints);
    document.getElementById('user1').srcObject = localStream;

    // Add event listeners
    document.getElementById('camerabutton').addEventListener('click', toggleCamera);
    document.getElementById('micbutton').addEventListener('click', toggleMic);
};


let handleUserLeft = (MemberId) => {
  document.getElementById('user2').style.display = 'none';
};

let handleMessageFromPeer = async (message, MemberId) => {
    message = JSON.parse(message.text);
  
    // Check the current file and the sender's file
    const currentFile = document.body.id === 'vp' ? 'v.html' : 'l.html';
    const senderFile = message.file;
  
    // If the current file and sender's file are the same, or if both are vp or lp, do nothing
    if (currentFile === senderFile || (currentFile === 'vp' && senderFile === 'vp') || (currentFile === 'lp' && senderFile === 'lp')) {
      console.log("Peers of same type attempting to connect or same page. Doing nothing.");
      return;
    }
  
    if (message.type === 'offer') {
      createAnswer(MemberId, message.offer);
    }
  
    if (message.type === 'answer') {
      addAnswer(MemberId, message.answer);
    }
  
    if (message.type === 'candidate') {
      if (peerConnection) {
        peerConnection.addIceCandidate(message.candidate);
      }
    }
  };
  
  let handleUserJoined = async (MemberId) => {
    console.log('User joined:', MemberId);
  
    const currentFile = document.body.id;
  
    // If both users are on the same page, do nothing
    if ((currentFile === 'vp' && MemberId === 'vp') || (currentFile === 'lp' && MemberId === 'lp')) {
      console.log("Peers of same type attempting to connect.");
      return;
    }
  
    // If the current user is on v.html and the other user is on l.html, or vice versa,
    // create an offer as before
    if ((currentFile === 'vp' && MemberId !== 'vp') || (currentFile === 'lp' && MemberId === 'vp')) {
      createOffer(MemberId, currentFile);
    }
};

let createPeerConnection = async (MemberId) => {
  peerConnection = new RTCPeerConnection(servers);
  remoteStream = new MediaStream();
  document.getElementById('user2').srcObject = remoteStream;
  document.getElementById('user2').style.display = 'block';

  if (!localStream) {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    document.getElementById('user1').srcObject = localStream;
  }

  localStream.getTracks().forEach((track) => {
    peerConnection.addTrack(track, localStream);
  });

  peerConnection.ontrack = (event) => {
    event.streams[0].getTracks().forEach((track) => {
      remoteStream.addTrack(track);
    });
  };

  peerConnection.onicecandidate = async (event) => {
    if (event.candidate) {
      const currentFile = document.body.id === 'vp' ? 'v.html' : 'l.html';
      client.sendMessageToPeer({ text: JSON.stringify({ 'type': 'candidate', 'candidate': event.candidate, 'file': currentFile }) }, MemberId);
    }
  };
};

let createOffer = async (MemberId, currentFile) => {
  await createPeerConnection(MemberId);
  let offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  client.sendMessageToPeer({ text: JSON.stringify({ 'type': 'offer', 'offer': offer, 'file': currentFile }) }, MemberId);
  console.log('Offer: ', offer);
};

let createAnswer = async (MemberId, offer) => {
  await createPeerConnection(MemberId);
  await peerConnection.setRemoteDescription(offer);
  let answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  const currentFile = document.body.id === 'vp' ? 'v.html' : 'l.html';
  client.sendMessageToPeer({ text: JSON.stringify({ 'type': 'answer', 'answer': answer, 'file': currentFile }) }, MemberId);
};

let addAnswer = async (MemberId, answer) => {
  if (!peerConnection.currentRemoteDescription) {
    await peerConnection.setRemoteDescription(answer);
  }
};

let leaveChannel = async () => {
  await channel.leave();
  await client.logout();
};

let toggleCamera = async () => {
    let videoTrack = localStream.getTracks().find(track => track.kind === 'video')

    if(videoTrack.enabled){
        videoTrack.enabled = false
        document.getElementById('camerabutton').style.backgroundColor = 'rgb(255,80,80,1)'
    }else{
        videoTrack.enabled = true
        document.getElementById('camerabutton').style.backgroundColor = 'rgb(1,1,1,0.5)'
    }
}

let toggleMic = async () => {
    let audioTrack = localStream.getTracks().find(track => track.kind === 'audio')

    if(audioTrack.enabled){
        audioTrack.enabled = false
        document.getElementById('micbutton').style.backgroundColor = 'rgb(255,80,80,1)'
    }else{
        audioTrack.enabled = true
        document.getElementById('micbutton').style.backgroundColor = 'rgb(1,1,1,0.5)'
    }
}

window.addEventListener('beforeunload', leaveChannel);


init()
