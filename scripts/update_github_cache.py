#!/usr/bin/env python3
"""
Skrypt odświeżania codziennego cache z GitHub API dla repozytoriów WellManifest.
Uruchamiany automatycznie lub na żądanie użytkownika z poziomu dashboardu.
"""

import os
import sys
import json
import urllib.request
import urllib.error
import datetime

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
LANDING_DIR = os.path.dirname(SCRIPT_DIR)
CACHE_FILE = os.path.join(LANDING_DIR, "projects_cache.json")
WORKSPACE_DIR = os.path.dirname(LANDING_DIR)

GITHUB_ORG = os.getenv("GITHUB_ORG", "wellmanifest")
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")

def fetch_github_repo_info(repo_id):
    url = f"https://api.github.com/repos/{GITHUB_ORG}/{repo_id}"
    req = urllib.request.Request(url)
    req.add_header("User-Agent", "WellManifest-CacheUpdater/1.0")
    if GITHUB_TOKEN:
        req.add_header("Authorization", f"token {GITHUB_TOKEN}")
    
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            if resp.status == 200:
                data = json.loads(resp.read().decode('utf-8'))
                return {
                    'stars': data.get('stargazers_count', 0),
                    'forks': data.get('forks_count', 0),
                    'issues': data.get('open_issues_count', 0),
                    'language': data.get('language') or 'Python',
                    'updated_at': data.get('updated_at', '')
                }
    except Exception as e:
        print(f"[Warning] Cannot fetch live GitHub stats for {repo_id}: {e}")
    return None

def update_cache():
    if not os.path.exists(CACHE_FILE):
        print(f"[Error] Cache file {CACHE_FILE} does not exist.")
        sys.exit(1)
        
    with open(CACHE_FILE, 'r', encoding='utf-8') as f:
        cache_data = json.load(f)
        
    updated_count = 0
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    
    print(f"[{now_iso}] Rozpoczynanie synchronizacji cache dla {len(cache_data.get('projects', {}))} projektów...")
    
    for proj_id, proj in cache_data.get('projects', {}).items():
        # Update local README if exists in workspace
        local_readme = os.path.join(WORKSPACE_DIR, proj_id, "README.md")
        if os.path.exists(local_readme):
            with open(local_readme, 'r', encoding='utf-8', errors='ignore') as rf:
                proj['readme'] = rf.read()
        
        # Try fetching live GitHub API stats
        gh_info = fetch_github_repo_info(proj_id)
        if gh_info:
            proj['stars'] = gh_info['stars']
            proj['forks'] = gh_info['forks']
            proj['issues'] = gh_info['issues']
            proj['language'] = gh_info['language']
            proj['last_commit'] = gh_info['updated_at']
            updated_count += 1

    cache_data['last_updated'] = now_iso
    cache_data['source'] = f"GitHub API & Local Workspace (Updated {now_iso[:10]})"
    
    with open(CACHE_FILE, 'w', encoding='utf-8') as f:
        json.dump(cache_data, f, indent=2, ensure_ascii=False)
        
    print(f"[Success] Odświeżono cache z sukcesem. Zaktualizowano z GitHub API: {updated_count} repozytoriów.")
    return cache_data

if __name__ == '__main__':
    update_cache()
