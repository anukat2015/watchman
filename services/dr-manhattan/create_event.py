import sys, os, requests
from geo_handler import GeoHandler
sys.path.append(os.path.join(os.path.dirname(__file__), "../util"))
from redis_dispatcher import Dispatcher
from loopy import Loopy
from louvaine import Louvaine

def set_err(job, msg):
    job['state'] = 'event'
    job['data'] = []
    job['error'] = msg

def err_check(job):
    print "Checking job parameters"
    if job.get('type') == 'event':
        if 'start_time_ms' not in job.keys():
            set_err(job, "No 'start_time_ms' in job fields")
        if 'end_time_ms' not in job.keys():
            set_err(job, "No 'end_time_ms' in job fields")
        if 'result_url' not in job.keys():
            set_err(job, "No 'result_url' in job fields")
        if 'job_id' not in job.keys():
            set_err(job, "No 'job_id' in job fields")
        if 'query_url' not in job.keys():
            set_err(job, "No 'query_url' in job fields")

def process_message(key, job):
    err_check(job)
    if job['state'] == 'error':
        return

    query_params = [{
        "query_type": "between",
        "property_name": "end_time_ms",
        "query_value": [job['start_time_ms'], job['end_time_ms']]
    }]

    lp_n = Loopy(job['query_url']+'aggregateClusters', query_params)
    com = Louvaine()
    while True:
        print 'Scrolling...{}'.format(lp_n.current_page)
        page = lp_n.get_next_page()
        if page is None:
            break
        for doc in page:
            com.add_node(doc)

    lp_e = Loopy(job['query_url']+'cluster', query_params)
    while True:
        print 'Scrolling...{}'.format(lp_e.current_page)
        page = lp_e.get_next_page()
        if page is None:
            break
        for doc in page:
            com.add_edge(doc)

    com.get_communities()




if __name__ == '__main__':
    global g_h
    g_h = GeoHandler()
    dispatcher = Dispatcher(redis_host='redis',
                            process_func=process_message,
                            channels=['genie:event'])
    dispatcher.start()