#!/usr/bin/env python3
"""Offline queue proxy. No Gmail/Graph/Cloudflare traffic or runtime measurements.
 Same seeded arrivals for baseline 15-minute and adaptive 3/15-minute scheduling.
 A message requires one list and one fetch (simplified); one account per tick.
 """
import csv,json,math,random,statistics
from collections import deque
from pathlib import Path

def sample(rate,rng):
    mean=rate*3/1440
    # Poisson Knuth; 3-minute buckets are small even for 200 emails/day.
    cut=math.exp(-mean);p=1.;n=0
    while p>cut:
        n+=1;p*=rng.random()
    return n-1

def simulate(accounts,rate,old=False,missing=.0,days=30,seed=21):
    rng=random.Random(seed);failure_rng=random.Random(seed+101);queues=[deque() for _ in range(accounts)]
    due=[0]*accounts;last=[-1]*accounts
    arrived=done=missed=provider_calls=0;maxq=0;wait=[];daily_calls=0;daily_reads=0
    for t in range(days*480):
        minute=3*t
        if t%480==0:daily_calls=daily_reads=0
        for a in range(accounts):
            n=sample(rate,rng);arrived+=n;queues[a].extend([minute]*n)
        maxq=max(maxq,sum(len(q) for q in queues))
        if old and t%5:continue
        candidates=[a for a in range(accounts) if due[a]<=minute]
        if not candidates:continue
        a=min(candidates,key=lambda x:(last[x],x))
        if failure_rng.random()<missing:missed+=1;continue
        # Approx. two provider calls for a read; one for no-mail polling.
        permitted=daily_calls<500
        take=bool(queues[a]) and daily_reads<200 and daily_calls+2<=500
        if permitted:
            daily_calls+=2 if take else 1;provider_calls+=2 if take else 1
        if permitted and take:
            arrival=queues[a].popleft();done+=1;daily_reads+=1;wait.append(minute-arrival)
        # In real adapters a nextPage/nextLink indicates backlog; this proxy uses
        # current queue length, an optimistic signal; flag as model limitation.
        delay=15 if old or not queues[a] else 3
        due[a]=minute+delay;last[a]=minute
    wait.sort()
    percentile=lambda f:wait[min(len(wait)-1,max(0,math.ceil(len(wait)*f)-1))] if wait else None
    return dict(model='legacy_15m' if old else 'adaptive_3m_15m',accounts=accounts,emails_per_account_day=rate,cron_loss=missing,arrived=arrived,processed=done,backlog=arrived-done,max_backlog=maxq,provider_calls=provider_calls,p50_delay_minutes=percentile(.5),p95_delay_minutes=percentile(.95),p99_delay_minutes=percentile(.99))

if __name__=='__main__':
    rows=[]
    for a in (1,2):
        for rate in (5,25,50,100,200):
            for failure in (0,.2):
                for old in (True,False):rows.append(simulate(a,rate,old,failure))
    path=Path(__file__).parent
    with (path/'results-schedule-2.2.csv').open('w',newline='') as f:
        w=csv.DictWriter(f,fieldnames=list(rows[0]));w.writeheader();w.writerows(rows)
    (path/'results-schedule-2.2.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
    for r in rows:
        if r['accounts']==2 and r['emails_per_account_day'] in (50,100,200) and r['cron_loss']==0:
            print(json.dumps(r,ensure_ascii=False))
