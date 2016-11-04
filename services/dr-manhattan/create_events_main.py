import sys, os, argparse
sys.path.append(os.path.join(os.path.dirname(__file__), "../util"))
from loopy import Loopy

def create_events(ts_start, ts_end):
    query_params = [{
        "query_type": "between",
        "property_name": "end_time_ms",
        "query_value": [ts_start, ts_end]
    }]
    com = Louvaine('watchmen:3003/api/',
               'watchmen:3003/api/extract/entities',
               'watchmen:3003/api/geocoder/forward-geo')
    lp_n = Loopy('watchmen:3003/api/aggregateClusters', query_params)
    while True:
        page = lp_n.get_next_page()
        if page is None:
            break
        for doc in page:
            com.add_node(doc)

    lp_e = Loopy('watchmen:3003/api/clusterLinks', query_params)
    while True:
        page = lp_e.get_next_page()
        if page is None:
            break
        for doc in page:
            com.add_edge(doc)

    com.save_communities()
    print "Communities Saved!"


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("start_time", type=int,  help="Milisecond timestamp for query start")
    parser.add_argument("end_time", type=int, help="Milisecond timestamp for query end")
    args = parser.parse_args()

    create_events(args.start_time, args.end_time)