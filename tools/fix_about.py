import os
p = 'C:/Users/Louis/Desktop/Code/Feats/about/index.html'
c = open(p, encoding='utf-8').read()

m = {
    '/music': '/feats-live/music',
    '/about': '/feats-live/about',
    '/contact': '/feats-live/contact',
    '/youth-development': '/feats-live/youth-development',
    '/privacy-policy': '/feats-live/privacy-policy',
    '/sitemap.xml': '/feats-live/sitemap.xml',
}

for k, v in m.items():
    c = c.replace('href="' + k + '"', 'href="' + v + '"')

c = c.replace('src="../images/', 'src="https://feats-api.fpvgate-analytics.workers.dev/images/')
c = c.replace('background-image:url(/images/', 'background-image:url(https://feats-api.fpvgate-analytics.workers.dev/images/')

open(p, 'w', encoding='utf-8').write(c)
print('Fixed about page')
