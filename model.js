var mongoose=require("mongoose");
//构造函数
var Schema=mongoose.Schema;

//新建PostSchema
var PostSchema=new Schema({
	url:String,
	title:String,
	imgs:[String],
	author:String,
	author_url:String,
	author_location:String,
	create_at:{type:Date,default:Date.now},	//创建时间
	update_at:{type:Date,default:Date.now}	//更新时间
});

var Post=mongoose.model("Post",PostSchema);

exports.Post=Post;