const http = require('http');
const https = require ('https');
const fs = require ('fs');
const url = require("url");

const iex_key = require("./authorization.json");
const nytimes_key= require("./ny_timesauth.json");


const server= http.createServer();

server.on("request",connection_hanlder);
function connection_hanlder(req,res){

    console.log(`New Request for ${req.url} from ${req.socket.remoteAddress}`);

	if(req.url === '/'){
		const main = fs.createReadStream('frontpage.html');
		res.writeHead(200, {'Content-Type':'text/html'});
		main.pipe(res);
	}
	else if (req.url === '/favicon.ico'){
		const main = fs.createReadStream('favicon_io/favicon.ico');
		res.writeHead(200, {'Content-Type':'image/x-icon'});
		main.pipe(res);
	} 
	else if (req.url.startsWith("/search")){
		let params = new URLSearchParams(`${req.url}`);
		let name = params.get('/search?stock');
        get_stockinfo(name,res);
        res.writeHead(200, {'Content-Type': 'text/html'});
	}
	else{
		res.writeHead(404, "Not Found", {"Content-Type":"text/html"});
		res.write(`<h1>404 Not Found </h1>`);
		res.end();
	}

}



function get_stockinfo(stock, res){
   //counter for asynchronous 
    let counter = {task_completed: 0};
    
    // IEX cloud request
    const stock_endpoint = `https://cloud.iexapis.com/stable/stock/${stock}/company?token=${iex_key.token}`;
    const stock_request = https.get(stock_endpoint, {method:"GET"});
    stock_request.once("response", stock_stream => process_stream (stock_stream,parse_IEXresults));
    
    setTimeout(()=>stock_request.end(), 1000);


    //ny times request
    const nytimes_endpoint =`https://api.nytimes.com/svc/search/v2/articlesearch.json?q=${stock}&sort=newest&fq_news_desk:("Financial")&api-key=${nytimes_key.api_key}`;
    const nytimes_request = https.get(nytimes_endpoint, {method:"GET"});
    nytimes_request.once("response", stock_stream => process_stream(stock_stream,parse_nytimesresults));
    
    nytimes_request.end();

    
	function process_stream (stock_stream,callback){
		let stock_data = "";
		stock_stream.on("data", chunk => stock_data += chunk);
		stock_stream.on("end", () => callback(stock_data,counter, res));
	}
}

function parse_IEXresults(data,counter, res){
    try {
        let stock=JSON.parse(data);
        let name = stock.companyName;
	    let website = stock.website;
        let CEO = stock.CEO;
        results = `<h1>IEX Cloud Company Info:</h1><h2>${name}</h2><button onclick="document.location='${website}'">Click me to visit Company website!</button> <h3>${CEO}</h3>`;
        
    }catch (error){
        results =`<h1> No relevant stock ticker was found </h1>`;
        res.write(results , () => terminate (counter, res));
        res.end();
    }
    
	res.writeHead(200,{"Content-Type": "text/html"});
    res.write(results , () => terminate (counter, res));
}


function parse_nytimesresults(data,counter, res){
    let nytimes_object=JSON.parse(data);
    let articles = nytimes_object.response.docs;
    let results= articles.map(article_format);

    if (articles.length == 0 ){
        results=`<h1> No revelevant articles were found </h1>`;
    }else{
        results = `<meta charset="utf-8"/> <h1> Ny Times Articles:</h1>${results} </div>`;
    }
    function article_format(articles){
        let headline = articles.headline.main;
        let snippet = articles.snippet;
        let url =articles.web_url;
        return `<h3>${headline}</h3><p>${snippet}}</p><a href=${url}>Click this link for more info</a><hr>`;
    }
    res.write(results , () => terminate(counter, res));
}

function terminate(counter,res){

    counter.tasks_completed++;
    if(counter.task_completed === 2){
        res.end();
    }
}

server.listen(3000);
console.log("listening on port 3000");
