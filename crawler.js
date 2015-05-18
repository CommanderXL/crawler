var mongoose=require("mongoose");
var eventproxy=require("eventproxy");
var async=require("async");
var cheerio=require("cheerio");
var config=require("./config.js");
var model=require("./model.js");
var Post=model.Post;
var superagent=require("superagent");

mongoose.connect(config.mongodbURL);

//队列限制worker数量控制并发量.
var q=async.queue(function(task,callback){
	var postInfo=task;
	var ep=new eventproxy();
	ep.fail(callback);

	//验证数据库中是否存在这个url,如果存在则不进行抓取
	Post.findOne({url:postInfo.url},ep.done(function(post){
		if(post){
			return ep.emit("got_author");
		}
		ep.emit("fetch_author");
	}))

	ep.all("fetch_author",function(){
		superagent.get(postInfo.author_url)
			.set("User-Agent","Mozilla/5.0 (Windows NT 6.3; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2272.118 Safari/537.36")
			.set("Cookie",config.cookie)
			.end(ep.done(function(res){
				//状态不为200，即返回不成功
				if(res.status!==200){
					console.error(403,postInfo.author_url);
					return ep.emit("got_author");
				}
				var $=cheerio.load(res.text);
				var location=$(".loc").text().replace("常居: \n"," ").trim();
				//用Model发布Entity
				var post=new Post({
					url:postInfo.url,
					title:postInfo.title,
					imgs:postInfo.imgs,
					author:postInfo.author,
					author_url:postInfo.author_url,
					author_location:location
				});
				//Entity存入数据库
				post.save(ep.done(function(){
					ep.emit("got_author");
				}));
			}))
	})
	ep.all("got_author",function(){
		callback();
	});
//worker数量设为1
},1)

function fetchHaiXiuZu(){
	var ep=new eventproxy();
	ep.fail(function(err){console.error(err.message)});

	//请求数据库的内容.获取postInfo
	superagent.get("https://database.duoshuo.com/api/threads/listPosts.json?thread_key=haixiuzu&page=1&limit=100")
		.set("User-Agent","Mozilla/5.0 (Windows NT 6.3; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2272.118 Safari/537.36")
		.set("Cookie",config.cookie)
		.end(ep.done(function(res){
			var json=JSON.parse(res.text);
			var parentPosts=json.parentPosts;
			for(var postId in parentPosts){
				var postInfo=parentPosts[postId];
				//postInfo.message是用base64编码格式进行编码，则首先按base64存入buffer中，然后用JSON.parse进行解码
				postInfo=JSON.parse(new Buffer(postInfo.message,"base64"));
			}
			q.push(postInfo,ep.done(function(){}));
		}))
}

//每一分钟爬虫运行一次
setInterval(fetchHaiXiuZu,60*1000);
