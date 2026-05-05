import {WebSocketServer , WebSocket} from "ws";

const wss = new WebSocketServer({port: 8080});

//connection event
wss.on('connection' ,(socket,request)=>{
    
    const ip = request.socket.remoteAddress;

    socket.on("message" ,(rawData)=>{
        const message = rawData.toString();
        console.log({rawData});

        wss.clients.forEach((client) =>{
            if (client.readyState === WebSocket.OPEN )
                client.send(`Server Broadcasting: ${message}`);
        })
    });

    socket.on('error' ,(err) => {
        console.error('Error: ${err.message}: ${ip}');
    })

    socket.on('close' ,() => {
        console.log(`Client ${ip} disconnected`);
    });
});


console.log("WebSocket Server Is Running On ws://localhost:8080");