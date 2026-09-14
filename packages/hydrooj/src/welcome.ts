import DomainModel from './model/domain';
import ProblemModel from './model/problem';
import RecordModel from './model/record';

const bulletin = `\\
### 欢迎使用 NAFOJ

系统已初始化完成。管理员请登录后按照首页的「部署引导」清单完成剩余配置；
题目配置指南可参考 [Hydro 文档](https://hydro.js.org)。

### Welcome to NAFOJ

Setup is complete. Admins: finish the remaining configuration via the
onboarding checklist on the homepage. For problem configuration see the
[Hydro docs](https://hydro.js.org).
`;

const defaultProblem = JSON.stringify({
    en: `\
This is the example A+B problem.
If you didn't see 'No testdata at current' message, it means file storage is working properly.

Just write a program that reads two integers from standard input, and prints their sum to standard output.
Feel free to delete this problem in 'Edit' panel if you don't need this.

Click 'Enter Online Programming Mode' to open the built-in Hydro IDE.
`,
    zh: `\
这是一道简单的 A+B 题目。
如果您没有看到“当前没有测试数据”的消息，说明文件存储功能正常运行。

编写一个程序，从标准输入读取两个整数，并将它们的和输出到标准输出。
如果您不需要这道题目，可以在右侧“编辑”面板中删除它。

点击右侧 “进入在线编程模式” 打开内置的 Hydro IDE。
`,
});

const testdatas = {
    'config.yaml': 'time: 1s\nmemory: 64m\n',
    '1.in': '1 2\n',
    '1.out': '3\n',
    '2.in': '1 1\n',
    '2.out': '2\n',
};

const std = `\
// 这是由 Hydro 自动提交的测试代码，用于测试系统是否正常运行。
// 如果这个提交返回了 Accepted ，则说明一切正常。
// This is a submission by Hydro system, used to test if judge is working properly.
// If this submission returns 'Accepted', it means everything is fine.

#include<iostream>
using namespace std;
int main() {
  int a, b;
  cin >> a >> b;
  cout << a + b << endl;
  return 0;
}
`;

export default async function apply() {
    if (process.env.CI) return;
    await DomainModel.edit('system', { bulletin });
    const docId = await ProblemModel.add('system', 'P1000', 'A+B Problem', defaultProblem, 1, ['系统测试']);
    // This might fail so we are doing it asynchronously.
    Promise.all(
        Object.keys(testdatas).map(
            (i) => ProblemModel.addTestdata('system', docId, i, Buffer.from(testdatas[i])),
        ),
    ).then(() => RecordModel.add('system', docId, 1, 'cc', std, true));
}
