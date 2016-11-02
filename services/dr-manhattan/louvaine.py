import community, sys, os
import networkx as nx
from random import sample
sys.path.append(os.path.join(os.path.dirname(__file__), "../util"))
from loopy import Loopy
sys.path.append(os.path.join(os.path.dirname(__file__), "../rorschach/util"))
from sentiment_filters import SentimentFilter

class Louvaine:
    def __init__(self, base_url):
        self.graph = nx.Graph()
        self.nodes_detailed = {}
        stop_file = open(os.path.dirname(__file__) + '/files/' + 'stopWordList.txt', 'r')
        self.stop = set([])
        for line in stop_file:
            self.stop.add(line.strip('\n').strip('\r'))

        self.sf = SentimentFilter()
        if base_url[-1] == '/':
            self.url = base_url
        else:
            self.url = base_url + '/'

    def add_node(self, agg_cluster):
        n_id = agg_cluster['id']
        self.graph.add_node(n_id)
        self.nodes_detailed[n_id] = agg_cluster


    def add_edge(self, c_link):
        self.graph.add_edge(c_link['source'], c_link['target'], {'weight':c_link['weight']})

    def get_text_sum(self, cluster):
        n_posts = len(cluster['similar_post_ids'])
        l_sample = cluster['similar_post_ids']
        if n_posts > 50:
            l_sample = sample(cluster['similar_post_ids'], 50)

        words = {}

        #TODO: fix query type once S.L. is fixed
        for id in l_sample:
            query_params = [{"query_type":"between",
                     "property_name":"post_id",
                     "query_value":[id, id]
            }]
            lp = Loopy(self.url + 'socialMediaPosts', query_params)
            page = lp.get_next_page()
            if page is None:
                continue
            for doc in page:
                for word in [w for w in self.sf.tokenize(doc['text'], doc['lang']) if w not in self.stop]:
                    if word in words:
                        words[word] += 1
                    else:
                        words[word] = 1
                break

        words = {key:value for key, value in words.iteritems() if value > 5}

        return words


    def get_img_sum(self, cluster):
        n_posts = len(cluster['similar_post_ids'])
        l_sample = cluster['similar_post_ids']
        if n_posts > 10:
            l_sample = sample(cluster['similar_post_ids'], 10)

        imgs = set([])

        #TODO: fix query type once S.L. is fixed
        for id in l_sample:
            query_params = [{"query_type":"between",
                     "property_name":"post_id",
                     "query_value":[id, id]
            }]
            lp = Loopy(self.url + 'socialMediaPosts', query_params)
            page = lp.get_next_page()
            if page is None:
                continue
            for doc in page:
                if doc['featurizer'] != "image":
                    continue
                imgs.add(doc['primary_image_url'])
                break

        return list(imgs)


    def get_communities(self):
        partition = community.best_partition(self.graph)
        d1 = {}
        for n in self.graph.nodes():
            com = str(partition[n])
            clust = self.nodes_detailed[n]
            if com in d1:
                d1[com]['aggregate_cluster_ids'].append(n)
                d1[com]['topicMessageCount'] += len(clust['similar_post_ids'])

            else:
                d1[com] = {
                    'name': 'default',
                    'start_time_ms': clust['start_time_ms'],
                    'end_time_ms':clust['end_time_ms'],
                    'aggregate_cluster_ids':[n],
                    'hashtags':{},
                    'keywords':{},
                    'urls':[],
                    'image_urls':[],
                    'importanceScore':1.0,
                    'topicMessageCount':len(clust['similar_post_ids'])}

            if clust['data_type'] == 'hashtag':
                d1[com]['hashtags'][clust['term']] = len(clust['similar_post_ids'])
            elif clust['data_type'] == 'image':
                d1[com]['image_urls'].extend(self.get_img_sum(clust))
            elif clust['data_type'] == 'text':
                word_sum = self.get_text_sum(clust)
                for k, v in word_sum.iteritems():
                    if k in d1[com]['keywords']:
                        d1[com]['keywords'][k] += v
                    else:
                        d1[com]['keywords'][k] = v
            if clust['start_time_ms'] < d1[com]['start_time_ms']:
                d1[com]['start_time_ms'] = clust['start_time_ms']
            if clust['end_time_ms'] > d1[com]['end_time_ms']:
                d1[com]['end_time_ms'] = clust['end_time_ms']


        for com in d1.keys():
            l_tags = map(lambda x: x[0], sorted([(k, v) for k, v in d1[com]['hashtags']], key=lambda x: x[1]))
            if len(l_tags) > 10:
                d1[com]['hashtags'] = l_tags[:10]
            else:
                d1[com]['hashtags'] = l_tags

            l_terms = map(lambda x: x[0], sorted([(k, v) for k, v in d1[com]['keywords']], key=lambda x: x[1]))
            if len(l_terms) > 10:
                d1[com]['keywords'] = l_terms[:10]
            else:
                d1[com]['keywords'] = l_terms

        return d1
