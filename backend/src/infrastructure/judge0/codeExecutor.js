import axios from 'axios';

class CodeExecutor {
  constructor() {
    this.baseUrl = `${process.env.JUDGE0_API_URL}`;
    this.headers = {
      'x-rapidapi-host': 'judge0-ce.p.rapidapi.com',
      'x-rapidapi-key': process.env.JUDGE0_API_KEY,
      'content-type': 'application/json'
    };
    this.languageMap = {
      'cpp': { id: 54, name: 'C++', wrapper: this.getCppWrapper },
      'python': { id: 71, name: 'Python', wrapper: this.getPythonWrapper },
      'javascript': { id: 63, name: 'JavaScript', wrapper: this.getJavaScriptWrapper },
      'js': { id: 63, name: 'JavaScript', wrapper: this.getJavaScriptWrapper },
      'java': { id: 62, name: 'Java', wrapper: this.getJavaWrapper }
    };
    this.timeout = 10000; // 10 seconds timeout
  }

  getJavaScriptWrapper(userCode) {
    return `
    ${userCode}
    
    // Mock readline for Judge0
    const input = require('fs').readFileSync('/dev/stdin').toString().trim();
    const [n, arr] = input.split('\\n');
    const result = solve(parseInt(n), arr);
    console.log(result);
  `;
  }

  getPythonWrapper(userCode) {
    return `
${userCode}

n = int(input())
arr = list(map(int, input().split()))
result = solve(n, arr)
print(result)
    `;
  }

  getCppWrapper(userCode) {
    return `
#include <bits/stdc++.h>
#include <vector>
#include <string>
#include <sstream>
using namespace std;

${userCode}

int main() {
    int n;
    cin >> n;
    vector<int> arr(n);
    for(int i = 0; i < n; i++) {
        cin >> arr[i];
    }
    cout << solve(n, arr) << endl;
    return 0;
}
    `;
  }

  getJavaWrapper(userCode) {
    return `
import java.util.Scanner;
import java.util.Arrays;

public class Main {
    ${userCode}
    
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int n = scanner.nextInt();
        int[] arr = new int[n];
        for(int i = 0; i < n; i++) {
            arr[i] = scanner.nextInt();
        }
        System.out.println(solve(n, arr));
        scanner.close();
    }
}
    `;
  }

  async executeCode(code, testCases, language = 'javascript') {
    const langConfig = this.languageMap[language.toLowerCase()];
    if (!langConfig) {
      throw new Error(`Unsupported language: ${language}`);
    }

    const wrappedCode = langConfig.wrapper(code);
    console.log('Executing code for language:', language);

    const results = [];
    
    for (const testCase of testCases) {
      try {
        const submission = await this.createSubmission(
          wrappedCode, 
          testCase.input, 
          langConfig.id
        );

        const result = await this.getSubmissionResult(submission.token);
        results.push(this.formatResult(result, testCase));
      } catch (error) {
        results.push({
          input: testCase.input,
          output: '',
          expected: testCase.output,
          status: 'Execution Failed',
          error: error.message,
          passed: false
        });
      }
    }

    return results;
  }

  async createSubmission(code, stdin, languageId) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/submissions`,
        {
          source_code: code,
          stdin,
          language_id: languageId,
          redirect_stderr_to_stdout: true,
          cpu_time_limit: 5, // 5 seconds max
          memory_limit: 128000 // 128MB
        },
        {
          headers: this.headers,
          timeout: this.timeout
        }
      );
      return response.data;
    } catch (error) {
      throw new Error(`Submission failed: ${error.response?.data?.error || error.message}`);
    }
  }

  async getSubmissionResult(token) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < this.timeout) {
      try {
        const response = await axios.get(
          `${this.baseUrl}/submissions/${token}`,
          {
            headers: this.headers,
            timeout: this.timeout
          }
        );
        
        const statusId = response.data.status?.id;
        
        // Status IDs: 1: In Queue, 2: Processing
        if (statusId > 2) {
          return response.data;
        }
        
        // Wait before polling again
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        throw new Error(`Result retrieval failed: ${error.response?.data?.error || error.message}`);
      }
    }
    
    throw new Error('Evaluation timeout exceeded');
  }

  formatResult(result, testCase) {
    const statusId = result.status?.id;
    const statusDescription = this.getStatusDescription(statusId);
    const output = result.stdout?.trim() || '';
    const expected = testCase.output.trim();
    const passed = statusId === 3 && output === expected;

    return {
      input: testCase.input,
      output: output,
      expected: expected,
      status: statusDescription,
      time: result.time,
      memory: result.memory,
      error: result.stderr || result.compile_output || '',
      passed: passed
    };
  }

  getStatusDescription(statusId) {
    const statusMap = {
      1: 'In Queue',
      2: 'Processing',
      3: 'Accepted',
      4: 'Wrong Answer',
      5: 'Time Limit Exceeded',
      6: 'Compilation Error',
      7: 'Runtime Error',
      8: 'Memory Limit Exceeded',
      9: 'Output Limit Exceeded',
      10: 'Internal Error',
      11: 'Exec Format Error'
    };
    return statusMap[statusId] || 'Unknown Status';
  }
}

export default CodeExecutor;