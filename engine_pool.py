from concurrent.futures import ThreadPoolExecutor

# 동시 집필 최대 수 (서버 사양에 따라 조정)
# 개발 PC: 3 / Railway: 2 / VPS: 4~5
executor = ThreadPoolExecutor(max_workers=3)
