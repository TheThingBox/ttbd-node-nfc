module.exports = function(RED) {
  var isUtf8 = require('is-utf8');

  function matchTopic(ts, t) {
    if (ts == "#") {
      return true;
    }
    var re = new RegExp("^" + ts.replace(/([\[\]\?\(\)\\\\$\^\*\.|])/g, "\\$1").replace(/\+/g, "[^/]+").replace(/\/#$/, "(\/.*)?") + "$");
    return re.test(t);
  }

  function nfcRead(config) {
    RED.nodes.createNode(this, config);
    this.broker = config.broker;
    this.brokerConn = RED.nodes.getNode(this.broker);

    this.topic_1 = '+/nfc/value/read'
    this.topic_2 = 'system/nfc/tag'

    var node = this;

    var received = function(topic, payload, packet){
      if (isUtf8(payload)) { payload = payload.toString(); }
      try{
        payload = JSON.parse(payload)
      } catch(e){}
      var message = {}
      var action = 'in'
      if(matchTopic(node.topic_1, topic) === true){
        if(payload.id){
          message = {
            topic: `nfc/${payload.id}`,
            tag_id: payload.id,
            tag_infos: payload.infos || null,
            tag_data: payload.data || null,
            error: payload.error || undefined,
            payload: payload.data || null
          }
          if(payload.removed === true){
            action = 'out'
          }
        }
      } else if(matchTopic(node.topic_2, topic) === true){
        if(payload.UID){
          message = {
            topic: `nfc/${payload.UID}`,
            tag_id: payload.UID,
            tag_infos: payload
          }
          if(payload.hasOwnProperty('MessageType') && payload.MessageType.toLowerCase() === 'text' && payload.hasOwnProperty(payload.MessageType)) {
            message.tag_data = {
              type: payload.MessageType,
              value: payload[payload.MessageType]
            }
            message.payload = payload[payload.MessageType]
          }
        }
      }

      if(!message.tag_id){
        return
      }

      if(action === 'in'){
        node.send([message, null])
      } else if(action === 'out'){
        node.send([null, message])
      }
    }

    if(this.brokerConn) {
      this.status({fill:"red",shape:"ring",text:"node-red:common.status.disconnected"});
      node.brokerConn.register(node)
      this.brokerConn.subscribe(this.topic_1, 0, received)
      this.brokerConn.subscribe(this.topic_2, 0, received)

      if(this.brokerConn.connected) {
        node.status({fill:"green",shape:"dot",text:"node-red:common.status.connected"});
      }
    }

    this.on('close', function(done) {
      if(node.brokerConn){
        node.brokerConn.deregister(node, done)
      } else {
        done()
      }
    })
  }
  RED.nodes.registerType("nfc in", nfcRead);
}
