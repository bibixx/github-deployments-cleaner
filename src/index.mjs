#!/usr/bin/env node

import fetch from 'node-fetch'
import inquirer from 'inquirer'
import chalk from 'chalk'

(async () => {
  const { owner, repo, token, removeAll } = await inquirer.prompt([
      {
        type: 'input',
        name: 'owner',
        message: "Who is the repo's owner? (https://github.com/OWNER/repo)",
        validate: Boolean
      },
      {
        type: 'input',
        name: 'repo',
        message: "What is the repo's name? (https://github.com/owner/REPO)",
        validate: Boolean
      },
      {
        type: 'input',
        name: 'token',
        message: "GitHub access token",
        validate: Boolean
      },
      {
        type: 'confirm',
        name: 'removeAll',
        default: false,
        message: "Do you want to remove all deployments, including successful ones?"
      }
    ])

  const makeRequest = async (path = '/', options = {}) => {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/${path.replace(/^\//, '')}`,
      {
        ...options,
        headers: {
          'Authorization': `token ${token}`,
          ...options.headers
        },
      }
    )

    if (!response.ok) {
      throw new Error(`${response.status}: ${await response.text()}`)
    }

    return response
  }

  try {
    // Fetch list of deployments
    const deploymentsList = await makeRequest("/deployments").then(res => res.json())
    const ids = deploymentsList.map(({ id }) => id)

    for await (const id of ids) {
      console.log(chalk.blue(`Deleting ${id}...`));

      // Fetch status of the deployment. Deployments with status "success" cannot be removed
      const statusesGetResponse = await makeRequest(`/deployments/${id}/statuses`).then(res => res.json())
      if (statusesGetResponse.length === 0) {
        continue;
      }

      const state = statusesGetResponse[0].state

      if (state === 'success') {
        if (!removeAll) {
          continue;
        }

        // Change the status if it was previously success
        await makeRequest(
          `/deployments/${id}/statuses`,
          { method: 'POST', body: JSON.stringify({ "state": "failure" }) }
        ).then(res => res.text())
      }

      // Remove the deployment
      await makeRequest(`/deployments/${id}`, { method: 'DELETE' }).then(res => res.text())
    }

    console.log(chalk.green('DONE!'));
  } catch (error) {
    console.log(chalk.red(`Error ${error.message}`));
  }
})()
