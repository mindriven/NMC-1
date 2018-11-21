//      

const workers = {};
workers.start = function(){
    setInterval(()=>{
        console.log('test worker triggered at '+Date.now());
    }, 1000*10)
}

module.exports = {start: workers.start};