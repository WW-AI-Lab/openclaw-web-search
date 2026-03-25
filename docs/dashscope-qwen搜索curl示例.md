## 设置搜索量级策略
```bash
curl -X POST https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation \
-H "Authorization: Bearer $DASHSCOPE_API_KEY" \
-H "Content-Type: application/json" \
-d '{
    "model": "qwen-plus",
    "input":{
        "messages":[      
            {
                "role": "user",
                "content": "Qwen 2025年9月份发布了哪些模型？"
            }
        ]
    },
    "parameters": {
        "enable_search": true,
        "search_options": {
            "search_strategy": "max",
            "enable_source": true
        },
        "result_format": "message"
    }
}'
```

## 响应示例
```json
{
  "output": {
    "choices": [
      {
        "message": {
          "content": "根据提供的资料，2025年9月份阿里巴巴的千问(Qwen)系列发布了以下模型：\n\n1. **Qwen3-Next**：这是下一代基础模型架构，具有革命性的高稀疏度混合专家（MoE）架构。Qwen3-Next的总参数量达到了800亿，但在每次推理时仅激活30亿参数，显著降低了训练成本，并提升了推理效率。\n\n2. **Qwen3-Next-80B-A3B系列模型**：包括了Qwen3-Next-80B-A3B-Instruct与Qwen3-Next-80B-A3B-Thinking两个模型。这两个模型均基于Qwen3-Next-80B-A3B-Base模型训练而来，Base模型拥有800亿参数，30亿激活参数。\n\n3. **Qwen3-Max-Preview**：这是一个参数量超过1万亿的模型，支持最长256K tokens的上下文窗口，并覆盖超过100种语言。此模型已上线阿里云百炼平台，可通过API调用，并且Qwen Chat也同步上线了新模型，支持免费使用。\n\n这些模型的发布体现了阿里巴巴在大模型领域的持续创新和技术进步，尤其是在提高模型效率和降低训练成本方面取得了显著成就。",
          "role": "assistant"
        },
        "finish_reason": "stop"
      }
    ],
    "search_info": {
      "extra_tool_info": [],
      "search_results": [
        {
          "icon": "https://ss1.baidu.com/6ONXsjip0QIZ8tyhnq/it/u=493147230,3096476255&fm=195&app=88&f=JPEG?w=200&h=200",
          "site_name": "知乎",
          "index": 1,
          "title": "阿里Qwen3-Next技术解析:高稀疏度混合专家架构引领大模型新趋势!",
          "url": "https://zhuanlan.zhihu.com/p/1950881062403184335"
        },
        {
          "icon": "https://baijiahao.baidu.com/favicon.ico",
          "site_name": "百家号",
          "index": 2,
          "title": "阿里推出下一代模型架构;宇树王兴兴谈后悔的事丨新鲜早科技",
          "url": "https://baijiahao.baidu.com/s?id=1843023858158066280&wfr=spider&for=pc"
        },
        {
          "icon": "",
          "site_name": "",
          "index": 3,
          "title": "千问发布Qwen3-Max-Preview，参数量超1万亿",
          "url": "https://wallstreetcn.com/articles/3755053"
        },
        {
          "icon": "https://img.alicdn.com/imgextra/i2/O1CN01mvEkNg1mbgbrppM5C_!!6000000004973-55-tps-32-32.svg",
          "site_name": "新浪网",
          "index": 4,
          "title": "富瑞：阿里巴巴-W推新一代Qwen模型再创里程碑AI主题开启 ...",
          "url": "https://finance.sina.com.cn/stock/hkstock/hkgg/2025-09-08/doc-infpumzk6212010.shtml?cre=tianyi&mod=pchp&loc=7&r=0&rfunc=52&tj=cxvertical_pc_hp&tr=12"
        },
        {
          "icon": "https://img.alicdn.com/imgextra/i2/O1CN01mvEkNg1mbgbrppM5C_!!6000000004973-55-tps-32-32.svg",
          "site_name": "新浪网",
          "index": 5,
          "title": "富瑞：阿里巴巴-W推新一代Qwen模型再创里程碑AI主题开启 ...",
          "url": "https://finance.sina.com.cn/stock/hkstock/hkgg/2025-09-08/doc-infpumzk6212010.shtml?cre=tianyi&mod=pchp&loc=9&r=0&rfunc=64&tj=cxvertical_pc_hp&tr=12"
        },
        {
          "icon": "https://baijiahao.baidu.com/favicon.ico",
          "site_name": "百家号",
          "index": 6,
          "title": "行业观察|85天两次重大迭代,阿里大模型为什么死磕全球速度?",
          "url": "https://baijiahao.baidu.com/s?id=1838706037923454039&wfr=spider&for=pc"
        },
        {
          "icon": "https://img.alicdn.com/imgextra/i2/O1CN01FzHbv01o253A3z2Gd_!!6000000005166-55-tps-32-32.svg",
          "site_name": "博客园",
          "index": 7,
          "title": "Qwen-Image完整指南：2025年最强文本渲染AI图像生成模型 ...",
          "url": "https://www.cnblogs.com/sing1ee/p/19022727/2025-qwen-image"
        },
        {
          "icon": "https://ss1.baidu.com/6ONXsjip0QIZ8tyhnq/it/u=493147230,3096476255&fm=195&app=88&f=JPEG?w=200&h=200",
          "site_name": "知乎",
          "index": 8,
          "title": "阿里Qwen3-Next大模型深度解析:80B参数3B激活,成本降低10倍,速度提升10倍!",
          "url": "https://zhuanlan.zhihu.com/p/1950159852463687349"
        },
        {
          "icon": "https://developer.aliyun.com/favicon.ico",
          "site_name": "阿里云.",
          "index": 9,
          "title": "# Qwen3-8B 与 Qwen3-14B 的 TTFT 性能对比与底层原理详解",
          "url": "https://developer.aliyun.com/article/1672506"
        },
        {
          "icon": "",
          "site_name": "",
          "index": 10,
          "title": "Qwen模型发布时间线: 2023-2025",
          "url": "https://mylens.ai/space/zc02520s-workspace-hclkbo/qwen%E6%A8%A1%E5%9E%8B%E5%8F%91%E5%B8%83%E6%97%B6%E9%97%B4%E7%BA%BF-jenflw"
        }
      ]
    }
  },
  "usage": {
    "total_tokens": 2614,
    "output_tokens": 280,
    "input_tokens": 2334,
    "plugins": {
      "search": {
        "count": 1
      }
    },
    "prompt_tokens_details": {
      "cached_tokens": 0
    }
  },
  "request_id": "9fe63fe8-d274-4e6b-9249-5783449dc27a"
}
```