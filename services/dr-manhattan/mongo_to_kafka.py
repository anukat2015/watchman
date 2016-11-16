from kafka import KafkaProducer
from datetime import datetime
import json, requests, argparse

def mongo_to_kafka(rec):
    loc = sorted(rec['location'], key=lambda x: x['weight'], reverse=True)
    o_loc = None
    if len(loc) > 0:
        o_loc = {"type": "Point",
                         "coordinates": [
                             loc[0]["coords"][0]["lng"],
                             loc[0]["coords"][0]["lat"]
                         ]
                }
    return {'uid':rec['id'],
            'label':rec['name'],
            'startDate': datetime.fromtimestamp(rec['start_time_ms']/1000.0).isoformat(),
            'endDate': datetime.fromtimestamp(rec['end_time_ms']/1000.0).isoformat(),
            'hashtags': rec['hashtags'],
            'keywords':rec['keywords'],
            'urls':rec['urls'],
            'photos':rec['image_urls'],
            'importanceScore':rec['importance_score'],
            'topicMessageCount':rec['topic_message_count'],
            'campaigns': rec['campaigns'],
            'newsEventIds':[],
            'location': o_loc}

def stream_events(l_clusts, kafka_url, kafka_topic):
    print "Kafka URL:", kafka_url
    print "Mapping Events"
    kds = map(lambda x: mongo_to_kafka(x), l_clusts)
    producer = KafkaProducer(bootstrap_servers=kafka_url, value_serializer=lambda v: json.dumps(v).encode('utf-8'))
    for doc in kds:
        print "Event Sent"
        producer.send(kafka_topic, doc)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("mongo_url", type=str, help="URL for getting data from mongo")
    parser.add_argument("-kafka_url", type=str, help="If writing events to kafka, specify url (default=None)", default=None)
    parser.add_argument("-kafka_topic", type=str, help="If writing event to kafka, specify topic (default=None)", default=None)
    args = parser.parse_args()

    print "Requesting Events"
    r = requests.get("{}/api/events".format(args.mongo_url)).json()


    stream_events(r, args.kafka_url, args.kafka_topic)

